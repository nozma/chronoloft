from flask import Blueprint, request, jsonify
from ..models import Activity, ActivityUnitType
from .. import db
from sqlalchemy.exc import IntegrityError

activity_bp = Blueprint('activity', __name__)

@activity_bp.route('/api/activities', methods=['GET'])
def get_activities():
    activities = Activity.query.all()
    result = []
    for act in activities:
        result.append({
            'id': act.id,
            'name': act.name,
            'unit': act.unit.value if act.unit else None,
            'category_id': act.category_id,
            'category_name': act.category.name if act.category else None,
            'category_group': act.category.group.value if act.category.group else None,
            'asset_key': act.asset_key,
            'created_at': act.created_at.isoformat(),
            'is_active': act.is_active
        })
    return jsonify(result)

@activity_bp.route('/api/activities', methods=['POST'])
def add_activity():
    data = request.get_json()
    if not data or 'name' not in data or 'category_id' not in data:
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
        category_id=data['category_id'],
        unit=unit,
        asset_key=data.get('asset_key')
    )
    db.session.add(new_activity)
    db.session.commit()
    return jsonify({'message': 'Activity created', 'id': new_activity.id}), 201

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
    if 'asset_key' in data:
        activity.asset_key = data['asset_key']
    
    db.session.commit()
    return jsonify({'message': 'Activity updated'})

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
        db.session.rollback()
        # 外部キー制約により削除できない場合のエラーメッセージを返す
        return jsonify({'error': 'Cannot delete activity: associated records exist.'}), 400