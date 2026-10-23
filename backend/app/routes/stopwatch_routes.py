"""端末ごとに独立した計測と、LANからの操作を管理する。"""
import datetime
import math
import re
import time
import uuid
from threading import RLock
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from .. import db
from ..models import Activity, ActivityUnitType, LocalSetting, Record, StopwatchDevice, StopwatchSession
from . import discord_routes

stopwatch_bp = Blueprint('stopwatch', __name__)
_lock = RLock()


def install_stopwatches(app):
    with app.app_context():
        initialize_stopwatch_tables()
    from ..desktop_update import DesktopUpdateGate
    gate = DesktopUpdateGate(app, _lock, lambda: StopwatchSession.query.filter(
        StopwatchSession.status.in_(['running', 'confirming'])).first() is not None)
    gate.install()
    app.extensions['desktop_update_gate'] = gate
    app.register_blueprint(stopwatch_bp)


def initialize_stopwatch_tables():
    # 途中の版で作成済みのテーブルも、計測データを保持したまま更新する。
    with db.engine.begin() as connection:
        StopwatchDevice.__table__.create(connection, checkfirst=True)
        StopwatchSession.__table__.create(connection, checkfirst=True)
        columns = {column['name'] for column in inspect(connection).get_columns('stopwatch_session')}
        if 'active_key' not in columns:
            connection.exec_driver_sql('ALTER TABLE stopwatch_session ADD COLUMN active_key VARCHAR(48)')
        connection.exec_driver_sql(
            "UPDATE stopwatch_session SET active_key = device_id || ':' || slot "
            "WHERE status IN ('running', 'confirming') AND active_key IS NULL")
        # 列追加後に中断された場合も、次回起動で制約まで作成する。
        inspector = inspect(connection)
        unique_keys = inspector.get_unique_constraints('stopwatch_session')
        unique_indexes = [index for index in inspector.get_indexes('stopwatch_session') if index['unique']]
        if not any(key['column_names'] == ['active_key'] for key in unique_keys + unique_indexes):
            connection.exec_driver_sql(
                'CREATE UNIQUE INDEX uq_stopwatch_session_active_key ON stopwatch_session (active_key)')


def database_errors(function):
    @wraps(function)
    def protected(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except SQLAlchemyError:
            db.session.rollback()
            current_app.logger.exception('計測データの更新に失敗しました')
            return jsonify(error='計測データを保存できませんでした。接続を確認して再試行してください。'), 500
    return protected


def valid_id(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value
    except (ValueError, AttributeError):
        return False


def milliseconds(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 < value <= time.time() * 1000


def serialize(item):
    device = db.session.get(StopwatchDevice, item.device_id)
    activity = db.session.get(Activity, item.activity_id)
    with discord_routes._discord_lock:
        connected = any(session == item.id and (manager := discord_routes.DISCORD_MANAGERS.get(group))
                        and manager.is_connected()
                        for group, session in discord_routes.DISCORD_SESSIONS.items())
    return dict(id=item.id, device_id=item.device_id, device_name=device.name,
                is_local=device.is_local, slot=item.slot, activity_id=item.activity_id,
                activity_name=activity.name if activity else '削除済み',
                activity_group=activity.group.name if activity else None,
                activity_group_id=activity.group_id if activity else None,
                tags=[dict(id=t.id, name=t.name, color=t.color) for t in activity.tags] if activity else [],
                started_at=item.started_at, paused_at=item.paused_at, memo=item.memo,
                status=item.status, revision=item.revision, discord_enabled=item.discord_enabled,
                record_id=item.record_id, discord_connected=connected)


def sync_discord(item):
    error = _sync_discord(item)
    errors = current_app.extensions.setdefault('stopwatch_discord_errors', {})
    if error:
        errors[item.id] = error
    else:
        errors.pop(item.id, None)
    return error


def _sync_discord(item):
    # 操作した端末ではなく、計測を所属させた端末で連携対象を判定する。
    device = db.session.get(StopwatchDevice, item.device_id)
    if not device.is_local:
        return None
    try:
        if item.status != 'running' or not item.discord_enabled:
            for group, session in list(discord_routes.DISCORD_SESSIONS.items()):
                if session == item.id:
                    discord_routes.discord_presence_stop(dict(group=group, session_id=item.id))
            return None
        activity = db.session.get(Activity, item.activity_id)
        if not activity or not activity.group or not activity.group.client_id:
            return None
        for group, session in list(discord_routes.DISCORD_SESSIONS.items()):
            if session == item.id and group != activity.group.name:
                discord_routes.discord_presence_stop(dict(group=group, session_id=item.id))
        response, status = discord_routes.discord_presence_start(dict(
            group=activity.group.name, activity_name=activity.name,
            asset_key=activity.asset_key, session_id=item.id, start_time=item.started_at / 1000))
        return response.get_json().get('error') if status >= 400 else None
    except Exception:
        current_app.logger.exception('Discord連携の更新に失敗しました')
        return 'Discord連携の更新に失敗しました。計測は保存されています。'


@stopwatch_bp.put('/api/stopwatch-devices/<device_id>')
@database_errors
def register_device(device_id):
    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    name = data.get('name', '')
    if not valid_id(device_id) or not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        return jsonify(error='端末IDと1〜80文字の端末名が必要です。'), 400
    with _lock:
        if g.chronoloft_local:
            shared_name = db.session.get(LocalSetting, 'deviceName')
            if shared_name:
                name = shared_name.value
        item = db.session.get(StopwatchDevice, device_id)
        if item and item.is_local != g.chronoloft_local:
            return jsonify(error='接続先が変わりました。端末IDを再登録してください。'), 409
        if item is None:
            item = StopwatchDevice(id=device_id, name=name.strip(), is_local=g.chronoloft_local)
            db.session.add(item)
        else:
            item.name = name.strip()
        db.session.commit()
        return jsonify(id=item.id, name=item.name, is_local=item.is_local)


@stopwatch_bp.get('/api/stopwatches')
@database_errors
def list_stopwatches():
    with _lock:
        items = StopwatchSession.query.filter(StopwatchSession.status.in_(['running', 'confirming'])).all()
        errors = current_app.extensions.setdefault('stopwatch_discord_errors', {})
        active_ids = {item.id for item in items}
        for session_id in list(errors):
            if session_id not in active_ids:
                errors.pop(session_id, None)
        last_sync = current_app.extensions.get('stopwatch_discord_sync', 0)
        if time.monotonic() - last_sync >= 15:
            current_app.extensions['stopwatch_discord_sync'] = time.monotonic()
            for item in items:
                error = sync_discord(item)
                if error:
                    errors[item.id] = error
                else:
                    errors.pop(item.id, None)
        return jsonify(items=[serialize(item) for item in items], server_now=time.time() * 1000,
                       discord_errors=errors)


@stopwatch_bp.post('/api/stopwatches')
@database_errors
def start_stopwatch():
    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    if not valid_id(data.get('id')) or not valid_id(data.get('device_id')) or data.get('slot', 'main') not in ('main', 'sub'):
        return jsonify(error='計測ID、端末ID、計測枠が不正です。'), 400
    with _lock:
        device = db.session.get(StopwatchDevice, data['device_id'])
        if not device or device.is_local != g.chronoloft_local:
            return jsonify(error='この端末を先に登録してください。'), 403
        existing = db.session.get(StopwatchSession, data['id'])
        if existing:
            if existing.device_id != device.id:
                return jsonify(error='計測IDは使用済みです。'), 409
            return jsonify(item=serialize(existing), server_now=time.time() * 1000)
        if type(data.get('activity_id')) is not int:
            return jsonify(error='アクティビティIDが不正です。'), 400
        activity = db.session.get(Activity, data.get('activity_id'))
        if not activity or activity.unit != ActivityUnitType.MINUTES:
            return jsonify(error='時間を記録するアクティビティを選択してください。'), 400
        if StopwatchSession.query.filter_by(device_id=device.id, slot=data.get('slot', 'main')).filter(
                StopwatchSession.status.in_(['running', 'confirming'])).first():
            return jsonify(error='この端末では既に計測中です。画面を更新してください。'), 409
        started_at = data.get('started_at', time.time() * 1000)
        memo = data.get('memo', '')
        if not milliseconds(started_at) or not isinstance(memo, str) or len(memo) > 10000:
            return jsonify(error='開始時刻またはメモが不正です。'), 400
        item = StopwatchSession(id=data['id'], device_id=device.id, slot=data.get('slot', 'main'),
                                activity_id=activity.id, started_at=started_at,
                                active_key=f"{device.id}:{data.get('slot', 'main')}",
                                memo=re.sub(r'[\r\n\u2028\u2029]+', ' ', memo),
                                discord_enabled=device.is_local and data.get('slot', 'main') == 'main' and data.get('discord_enabled') is True)
        if data.get('paused_at') is not None:
            if not milliseconds(data['paused_at']) or data['paused_at'] < started_at:
                return jsonify(error='確認開始時刻が不正です。'), 400
            item.paused_at = data['paused_at']
            item.status = 'confirming'
        db.session.add(item)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify(error='この端末では既に計測中です。画面を更新してください。'), 409
        error = sync_discord(item)
        return jsonify(item=serialize(item), server_now=time.time() * 1000, discord_error=error), 201


@stopwatch_bp.post('/api/stopwatches/<session_id>/<action>')
@database_errors
def operate_stopwatch(session_id, action):
    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    with _lock:
        item = db.session.get(StopwatchSession, session_id)
        if not item:
            return jsonify(error='計測が見つかりません。'), 404
        # 完了済みへの再送は同じ保存結果を返し、記録を作り直さない。
        if item.status in ('completed', 'cancelled'):
            if action == ('complete' if item.status == 'completed' else 'cancel'):
                return jsonify(item=serialize(item), server_now=time.time() * 1000)
            return jsonify(error='この計測は既に終了しています。'), 409
        if type(data.get('revision')) is not int or data['revision'] != item.revision:
            return jsonify(error='計測が別の画面で変更されました。最新の状態を確認してください。'), 409
        expected_revision = item.revision
        if action == 'edit':
            if 'memo' in data:
                if not isinstance(data['memo'], str) or len(data['memo']) > 10000:
                    return jsonify(error='メモが不正です。'), 400
                item.memo = re.sub(r'[\r\n\u2028\u2029]+', ' ', data['memo'])
            if 'started_at' in data:
                if not milliseconds(data['started_at']) or (item.paused_at and data['started_at'] > item.paused_at):
                    return jsonify(error='開始時刻が不正です。'), 400
                item.started_at = data['started_at']
            if 'discord_enabled' in data:
                device = db.session.get(StopwatchDevice, item.device_id)
                if not g.chronoloft_local or not device.is_local or item.slot != 'main':
                    return jsonify(error='Discord連携設定は起動PC自身の計測だけが対象です。'), 403
                item.discord_enabled = data['discord_enabled'] is True
        elif action == 'confirm' and item.status == 'running':
            item.status = 'confirming'
            item.paused_at = time.time() * 1000
        elif action == 'resume' and item.status == 'confirming':
            # 確認画面を開いていた時間も含める既存の動作を維持する。
            item.status = 'running'
            item.paused_at = None
        elif action == 'cancel':
            item.status = 'cancelled'
        elif action == 'complete':
            end = item.paused_at or time.time() * 1000
            value = data.get('value', (end - item.started_at) / 60000)
            activity_id = data.get('activity_id', item.activity_id)
            if type(activity_id) is not int:
                return jsonify(error='アクティビティIDが不正です。'), 400
            activity = db.session.get(Activity, activity_id)
            memo = data.get('memo', item.memo)
            if not activity or activity.unit != ActivityUnitType.MINUTES or not isinstance(memo, str) or len(memo) > 10000:
                return jsonify(error='保存内容が不正です。'), 400
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
                return jsonify(error='計測時間が不正です。'), 400
            try:
                created_at = datetime.datetime.fromisoformat(data['created_at'].replace('Z', '+00:00')) if 'created_at' in data else datetime.datetime.fromtimestamp(end / 1000, datetime.timezone.utc)
                if created_at.tzinfo:
                    created_at = created_at.astimezone(datetime.timezone.utc).replace(tzinfo=None)
            except (ValueError, TypeError, AttributeError):
                return jsonify(error='終了時刻が不正です。'), 400
            memo = re.sub(r'[\r\n\u2028\u2029]+', ' ', memo)
            try:
                new_start = created_at - datetime.timedelta(minutes=value)
            except (OverflowError, ValueError):
                return jsonify(error='計測時間が不正です。'), 400
            # 既存と同じく、同一項目・同一メモで5分以内に続く記録はまとめる。
            candidates = Record.query.filter(Record.activity_id == activity_id,
                                             Record.created_at <= new_start,
                                             Record.created_at >= new_start - datetime.timedelta(minutes=5)).order_by(Record.created_at.desc()).all()
            record = next((candidate for candidate in candidates
                           if re.sub(r'[\r\n\u2028\u2029]+', ' ', candidate.memo or '') == memo
                           and candidate.value is not None and math.isfinite(candidate.value) and candidate.value >= 0), None)
            if record:
                merged_start = min(new_start, record.created_at - datetime.timedelta(minutes=record.value))
                record.value = (created_at - merged_start).total_seconds() / 60
                record.created_at = created_at
                record.memo = memo
            else:
                record = Record(activity_id=activity_id, value=value, memo=memo, created_at=created_at)
                db.session.add(record)
            db.session.flush()
            item.record_id = record.id
            item.status = 'completed'
        else:
            return jsonify(error='現在の計測状態では実行できない操作です。'), 400
        # 更新番号の条件をDBでも確認し、別プロセスからの同時操作も検出する。
        if item.status in ('completed', 'cancelled'):
            item.active_key = None
        values = {key: getattr(item, key) for key in ('memo', 'started_at', 'paused_at', 'status', 'discord_enabled', 'record_id', 'active_key')}
        with db.session.no_autoflush:
            changed = StopwatchSession.query.filter_by(id=item.id, revision=expected_revision).update(
                {**values, 'revision': expected_revision + 1}, synchronize_session=False)
        if not changed:
            db.session.rollback()
            return jsonify(error='計測が別の画面で変更されました。'), 409
        db.session.expire(item)
        db.session.commit()
        error = sync_discord(item)
        return jsonify(item=serialize(item), server_now=time.time() * 1000, discord_error=error)
