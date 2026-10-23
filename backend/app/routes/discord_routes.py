from flask import Blueprint, request, jsonify, current_app
from ..discord_presence_manager import get_discord_manager_for_group
from functools import wraps
from threading import RLock
from datetime import datetime, timedelta, timezone
import math
from sqlalchemy import func
from .. import db
from ..models import Activity, ActivityGroup, ActivityUnitType, Record, StopwatchSession

discord_bp = Blueprint('discord', __name__)

DISCORD_MANAGERS = {}
DISCORD_SESSIONS = {}
_discord_lock = RLock()


def recent_activity_minutes(group, activity_name, session_id):
    # 計測対象を特定し、入力された詳細ではなく保存済みの時間だけを集計する。
    query = Activity.query.join(ActivityGroup).filter(
        ActivityGroup.name == group, Activity.name == activity_name,
        Activity.unit == ActivityUnitType.MINUTES)
    session = db.session.get(StopwatchSession, session_id) if session_id else None
    if session is not None:
        query = query.filter(Activity.id == session.activity_id)
    activities = query.limit(2).all()
    if len(activities) != 1:
        return None
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    total = db.session.query(func.sum(Record.value)).filter(
        Record.activity_id == activities[0].id,
        Record.created_at >= now - timedelta(days=30), Record.created_at <= now,
        Record.value >= 0).scalar() or 0
    # 以前と同じく合計後に分単位へ四捨五入する。不正な値は公開しない。
    return math.floor(total + 0.5) if math.isfinite(total) else None


def serialized(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        # 同時要求による二重接続と通信ループの競合を防ぐ。
        with _discord_lock:
            return function(*args, **kwargs)
    return wrapped


@discord_bp.route('/api/discord_presence/start', methods=['POST'])
@serialized
def discord_presence_start(data=None):
    data = data if data is not None else request.get_json()
    # 旧画面から詳細が届いても、公開する情報として取得・転送しない。
    group = data.get('group')
    activity_name = data.get('activity_name')
    asset_key = data.get('asset_key') or "default_image"
    session_id = data.get('session_id')
    # 同じ計測からの要求だけ再接続・更新を許可する。
    for grp, mgr in list(DISCORD_MANAGERS.items()):
        if not mgr.is_connected():
            del DISCORD_MANAGERS[grp]
            DISCORD_SESSIONS.pop(grp, None)
            continue
        if mgr.is_connected() and not (grp == group and session_id and DISCORD_SESSIONS.get(grp) == session_id):
            return jsonify({'error': 'Another Discord session is active, cannot start a new one'}), 400
    manager = get_discord_manager_for_group(group)
    if not manager:
        return jsonify({'error': f'No CLIENT_ID for group {group}'}), 400
    try:
        previous_manager = DISCORD_MANAGERS.get(group)
        if previous_manager is not None and previous_manager is not manager:
            previous_manager.close()
        manager.connect()
        if not manager.is_connected():
            return jsonify({'error': manager.last_error or 'Failed to connect to Discord'}), 503
        if data.get('start_time') is not None:
            manager.start_time = float(data['start_time'])
        manager.update_presence(
            state=group,
            large_text=activity_name,
            large_image=asset_key,
            application_name=activity_name,
            recent_minutes=recent_activity_minutes(group, activity_name, session_id)
        )
        DISCORD_MANAGERS[group] = manager
        DISCORD_SESSIONS[group] = session_id
        return jsonify({'message': 'Discord presence started'}), 200
    except Exception as e:
        current_app.logger.error("Error in discord_presence: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@discord_bp.route('/api/discord_presence/stop', methods=['POST'])
@serialized
def discord_presence_stop(data=None):
    data = data if data is not None else request.get_json()
    group = data.get('group')
    if not group:
        return jsonify({'error': 'Group is required'}), 400

    manager = DISCORD_MANAGERS.get(group)
    if data.get('session_id') and DISCORD_SESSIONS.get(group) != data['session_id']:
        return jsonify({'error': 'Discord session belongs to another stopwatch'}), 409
    if manager:
        try:
            manager.close()
            del DISCORD_MANAGERS[group]
            DISCORD_SESSIONS.pop(group, None)
            return jsonify({'message': 'Discord presence stopped'}), 200
        except Exception as e:
            current_app.logger.error("Error in discord_presence: %s", e, exc_info=True)
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'No manager found'}), 400

@discord_bp.route('/api/discord_presence/status', methods=['GET'])
@serialized
def discord_presence_status():
    """
    現在Discordに接続中かどうかを返す簡易エンドポイント。
    全Groupを走査し、どこか is_connected=True があれば connected=True。
    """
    for mgr in DISCORD_MANAGERS.values():
        if mgr.is_connected():
            return jsonify({'connected': True})
    return jsonify({'connected': False})

@discord_bp.route('/api/discord_presence/update', methods=['POST'])
@serialized
def discord_presence_update():
    data = request.get_json()
    group = data.get('group')
    activity_name = data.get('activity_name')
    asset_key = data.get('asset_key') or "default_image"

    mgr = DISCORD_MANAGERS.get(group)
    if data.get('session_id') and DISCORD_SESSIONS.get(group) != data['session_id']:
        return jsonify({'error': 'Discord session belongs to another stopwatch'}), 409
    if not mgr or not mgr.is_connected():
        return jsonify({'error': 'No active Discord session'}), 400

    try:
        mgr.update_presence(
            state=group,
            large_text=activity_name,
            large_image=asset_key,
            application_name=activity_name,
            recent_minutes=recent_activity_minutes(group, activity_name, data.get('session_id'))
        )
        return jsonify({'message': 'Discord presence updated'}), 200
    except Exception as e:
        current_app.logger.error("Update failed: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500
