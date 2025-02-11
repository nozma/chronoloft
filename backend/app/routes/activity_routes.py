from flask import Blueprint, request, jsonify
from ..models import Activity, ActivityUnitType, Record
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
            result.append({
                'id': activity.id,
                'name': activity.name,
                'is_active': activity.is_active,
                'category_id': activity.category_id,
                'category_name': activity.category.name if activity.category else None,
                'category_group': activity.category.group.name if activity.category.group else None,
                'unit': activity.unit.value if activity.unit else None,
                'asset_key': activity.asset_key,
                'created_at': activity.created_at.isoformat(),
                # 追加情報として最新レコードのタイムスタンプも渡す（必要なら）
                'last_record': last_record.isoformat() if last_record else None,
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

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