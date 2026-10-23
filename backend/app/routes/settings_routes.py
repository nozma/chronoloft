"""起動PC専用の設定保存と、既存のブラウザー設定の取り込み。"""
from flask import g, jsonify, request
from sqlalchemy.dialects.sqlite import insert

from .. import db
from ..models import LocalSetting, StopwatchDevice
from .stopwatch_routes import database_errors, _lock


CHOICES = {
    'language': ('ja', 'en'),
    'themeMode': ('system', 'light', 'dark'),
    'layoutMode': ('one-column', 'two-column'),
    'recentDays': ('7', '14', '30', 'all'),
    'recentLimit': ('5', '15', '30', 'all'),
    'recentMinimum': ('1', '5', '15', '30'),
    'recordSaveMode': ('auto', 'confirm'),
}


def install_local_settings(app):
    # 既存DBにも追加できるよう、計測用テーブルと同様に起動時に初期化する。
    with app.app_context(), db.engine.begin() as connection:
        LocalSetting.__table__.create(connection, checkfirst=True)

    @app.route('/api/settings/local', methods=['GET', 'POST', 'PATCH'])
    @database_errors
    def local_settings():
        if not g.chronoloft_local:
            return jsonify(error='起動PCの設定は、そのPCからのみ操作できます。'), 403
        with _lock:
            if request.method != 'GET':
                data = request.get_json(silent=True)
                if not isinstance(data, dict) or not all(valid(key, value) for key, value in data.items()):
                    return jsonify(error='設定の項目または値が不正です。'), 400
                for key, value in data.items():
                    statement = insert(LocalSetting).values(key=key, value=value)
                    # 初回取り込みでは、他の画面が保存済みの値を上書きしない。
                    statement = (statement.on_conflict_do_nothing(index_elements=['key'])
                                 if request.method == 'POST' else
                                 statement.on_conflict_do_update(index_elements=['key'], set_={'value': value}))
                    db.session.execute(statement)
                name = db.session.get(LocalSetting, 'deviceName')
                if name:
                    StopwatchDevice.query.filter_by(is_local=True).update({'name': name.value})
                db.session.commit()
            return jsonify(settings={item.key: item.value for item in LocalSetting.query.all()})


def valid(key, value):
    if key in ('autoFilterOnSelect', 'discordEnabled'):
        return type(value) is bool
    if key == 'deviceName':
        return isinstance(value, str) and 1 <= len(value.strip()) <= 80 and value == value.strip()
    return key in CHOICES and isinstance(value, str) and value in CHOICES[key]
