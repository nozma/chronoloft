from flask import Blueprint, request, jsonify, current_app
from ..models import Activity, ActivityUnitType, Record, Tag
from .. import db
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import SQLAlchemyError 
from sqlalchemy import func, desc

activity_bp = Blueprint('activity', __name__)

@activity_bp.route('/api/activities', methods=['GET'])
def get_activities():
    try:
        # Activity と Record を外部結合して、各 Activity に対して最新の Record.created_at を取得
        query = db.session.query(
            Activity,
            func.max(Record.created_at).label('last_record')
        ).outerjoin(Record).group_by(Activity.id).order_by(desc('last_record'))
        
        activities_with_last = query.all()

        result = []
        for activity, last_record in activities_with_last:
            tag_list = []
            for t in activity.tags:
                tag_list.append({
                    'id': t.id,
                    'name': t.name,
                    'color': t.color
                })
            result.append({
                'id': activity.id,
                'name': activity.name,
                'tags': tag_list,  # ここで付与
                'is_active': activity.is_active,
                'group_id': activity.group_id,
                'group_name': activity.group.name if activity.group else None,
                'unit': activity.unit.value if activity.unit else None,
                'asset_key': activity.asset_key,
                'created_at': activity.created_at.isoformat(),
                'last_record': last_record.isoformat() if last_record else None,
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@activity_bp.route('/api/activities', methods=['POST'])
def add_activity():
    data = request.get_json()
    if not data or 'name' not in data or 'group_id' not in data:
        return jsonify({'error': '必要な情報が不足しています'}), 400

    unit = data.get('unit')
    if unit:
        try:
            unit = ActivityUnitType(unit)
        except ValueError:
            return jsonify({'error': 'unit の値が不正です'}), 400
    else:
        unit = None

    new_activity = Activity(
        name=data['name'],
        group_id=data['group_id'],
        unit=unit,
        asset_key=data.get('asset_key'),
        is_active=True
    )
    try:
        db.session.add(new_activity)
        db.session.commit()
        return jsonify({'message': 'Activity created', 'id': new_activity.id}), 201
    except SQLAlchemyError as e:
        current_app.logger.error("Error in add_activity: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@activity_bp.route('/api/activities/<int:activity_id>', methods=['PUT'])
def update_activity(activity_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400
    activity = Activity.query.get(activity_id)
    if activity is None:
        return jsonify({'error': 'Activity not found'}), 404

    if 'name' in data:
        activity.name = data['name']
    if 'group_id' in data:
        activity.group_id = data['group_id']
    if 'asset_key' in data:
        activity.asset_key = data['asset_key']
    if 'unit' in data:
        unit_value = data['unit']
        if unit_value is None:
            activity.unit = None
        else:
            try:
                activity.unit = ActivityUnitType(unit_value)
            except ValueError:
                return jsonify({'error': 'unit の値が不正です'}), 400
    if 'is_active' in data:
        activity.is_active = data['is_active']

    try:
        db.session.commit()
        return jsonify({'message': 'Activity updated'})
    except SQLAlchemyError as e:
        current_app.logger.error("Error in update_activity: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@activity_bp.route('/api/activities/<int:activity_id>', methods=['DELETE'])
def delete_activity(activity_id):
    activity = Activity.query.get(activity_id)
    if activity is None:
        return jsonify({'error': 'Activity not found'}), 404
    try:
        db.session.delete(activity)
        db.session.commit()
        return jsonify({'message': 'Activity deleted'}), 200
    except IntegrityError as e:
        current_app.logger.error("Error in add_activity: %s", e, exc_info=True)
        db.session.rollback()
        # 外部キー制約により削除できない場合のエラーメッセージを返す
        return jsonify({'error': 'Cannot delete activity: associated records exist.'}), 400

# タグの管理
@activity_bp.route('/api/activities/<int:activity_id>/tags', methods=['PUT'])
def set_activity_tags(activity_id):
    """ リクエストボディ: {'tag_ids': [1, 3, 5]} など """
    data = request.get_json()
    if not data or 'tag_ids' not in data:
        return jsonify({'error': 'tag_ids is required'}), 400

    activity = Activity.query.get(activity_id)
    if not activity:
        return jsonify({'error': 'Activity not found'}), 404

    # 受け取ったタグIDリストを元にタグを再構築
    new_tag_ids = data['tag_ids']
    new_tags = Tag.query.filter(Tag.id.in_(new_tag_ids)).all()

    # アクティビティに紐づけるタグを上書き (一旦全部クリアして追加)
    activity.tags.clear()
    activity.tags.extend(new_tags)

    try:
        db.session.commit()
        return jsonify({'message': 'Tags updated successfully'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500    
