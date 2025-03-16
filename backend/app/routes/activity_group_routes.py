from flask import Blueprint, request, jsonify, current_app
from ..models import ActivityGroup
from .. import db
from sqlalchemy.exc import SQLAlchemyError

activity_group_bp = Blueprint('activity_group', __name__, url_prefix='/api/activity_groups')

@activity_group_bp.route('/', methods=['GET'])
def get_activity_groups():
    """
    ActivityGroup テーブルの全グループを取得して JSON で返す
    """
    try:
        groups = ActivityGroup.query.order_by(ActivityGroup.position).all()
        result = []
        for group in groups:
            result.append({
                'id': group.id,
                'name': group.name,
                'client_id': group.client_id,
                'icon_name': group.icon_name,
                'icon_color': group.icon_color,
                'position': group.position
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_activity_groups: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@activity_group_bp.route('/', methods=['POST'])
def add_activity_group():
    """
    新規グループを追加する。リクエスト JSON には 'name'（必須）と 'client_id'（任意）が必要
    """
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '必要な情報が不足しています。'}), 400
    try:
        max_position = db.session.query(db.func.max(ActivityGroup.position)).scalar() or 0
        new_group = ActivityGroup(
            name=data['name'], 
            client_id=data.get('client_id'),
            icon_name=data.get('icon_name'),
            icon_color=data.get('icon_color'),
            position=max_position + 1
        )
        db.session.add(new_group)
        db.session.commit()
        return jsonify({'message': 'Activity group created', 'id': new_group.id}), 201
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_activity_groups: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@activity_group_bp.route('/<int:group_id>', methods=['PUT'])
def update_activity_group(group_id):
    """
    指定したグループの情報を更新する。リクエスト JSON には更新したい 'name' や 'client_id' を含める。
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400

    group = ActivityGroup.query.get(group_id)
    if group is None:
        return jsonify({'error': 'Activity group not found'}), 404

    try:
        if 'name' in data:
            group.name = data['name']
        if 'client_id' in data:
            group.client_id = data['client_id']
        if 'icon_name' in data:
            group.icon_name = data['icon_name']
        if 'icon_color' in data:
            group.icon_color = data['icon_color']
        if 'position' in data:
            group.position = data['position']
        db.session.commit()
        return jsonify({'message': 'Activity group updated'}), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_activity_groups: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@activity_group_bp.route('/<int:group_id>', methods=['DELETE'])
def delete_activity_group(group_id):
    """
    指定したグループを削除する。削除前に関連するカテゴリなどのデータとの整合性について検討する必要があります。
    """
    group = ActivityGroup.query.get(group_id)
    if group is None:
        return jsonify({'error': 'Activity group not found'}), 404

    try:
        db.session.delete(group)
        db.session.commit()
        return jsonify({'message': 'Activity group deleted'}), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_activity_groups: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500