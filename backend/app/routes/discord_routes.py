from flask import Blueprint, request, jsonify, current_app
from ..discord_presence_manager import get_discord_manager_for_group
import os

discord_bp = Blueprint('discord', __name__)

DISCORD_MANAGERS = {}

@discord_bp.route('/api/discord_presence/start', methods=['POST'])
def discord_presence_start():
    data = request.get_json()
    # 必要な情報（group, activity_name, details, asset_key）を取得
    group = data.get('group')
    activity_name = data.get('activity_name')
    details = data.get('details')
    asset_key = data.get('asset_key') or "default_image"
    # すでに接続が存在していたら重複して開始しない
    for grp, mgr in DISCORD_MANAGERS.items():
        if mgr.is_connected():
            return jsonify({'error': 'Another Discord session is active, cannot start a new one'}), 400
    manager = get_discord_manager_for_group(group)
    if not manager:
        return jsonify({'error': f'No CLIENT_ID for group {group}'}), 400
    try:
        manager.connect()
        manager.update_presence(
            state=activity_name,
            large_text=activity_name,
            details=details,
            large_image=asset_key
        )
        DISCORD_MANAGERS[group] = manager
        return jsonify({'message': 'Discord presence started'}), 200
    except Exception as e:
        current_app.logger.error("Error in discord_presence: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@discord_bp.route('/api/discord_presence/stop', methods=['POST'])
def discord_presence_stop():
    data = request.get_json()
    group = data.get('group')
    if not group:
        return jsonify({'error': 'Group is required'}), 400

    manager = DISCORD_MANAGERS.get(group)
    if manager:
        try:
            manager.close()
            del DISCORD_MANAGERS[group]
            return jsonify({'message': 'Discord presence stopped'}), 200
        except Exception as e:
            current_app.logger.error("Error in discord_presence: %s", e, exc_info=True)
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'No manager found'}), 400

@discord_bp.route('/api/discord_presence/status', methods=['GET'])
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
def discord_presence_update():
    data = request.get_json()
    group       = data.get('group')
    activity    = data.get('activity_name')
    details     = data.get('details')
    asset_key   = data.get('asset_key') or "default_image"

    mgr = DISCORD_MANAGERS.get(group)
    if not mgr or not mgr.is_connected():
        return jsonify({'error': 'No active Discord session'}), 400

    try:
        mgr.update_presence(
            state=activity,
            large_text=activity,
            details=details,
            large_image=asset_key
        )
        return jsonify({'message': 'Discord presence updated'}), 200
    except Exception as e:
        current_app.logger.error("Update failed: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500
