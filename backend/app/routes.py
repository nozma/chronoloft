from flask import Blueprint, request, jsonify
from . import db
from .models import Activity, Record, Category, ActivityUnitType, ActivityGroup

bp = Blueprint('main', __name__)

@bp.route('/api/activities', methods=['GET'])
def get_activities():
    activities = Activity.query.all()
    result = []
    for act in activities:
        result.append({
            'id': act.id,
            'name': act.name,
            'unit': act.unit.value if act.unit is not None else None,
            'category_id': act.category_id,
            'asset_key': act.asset_key,
            'created_at': act.created_at.isoformat(),
            'is_active': act.is_active
        })
    return jsonify(result)

@bp.route('/api/activities', methods=['POST'])
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