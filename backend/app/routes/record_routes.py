from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from ..models import Record
from .. import db

record_bp = Blueprint('record', __name__)

# GET /api/records: レコード一覧の取得
@record_bp.route('/api/records', methods=['GET'])
def get_records():
    try:
        records = Record.query.all()
        result = []
        for rec in records:
            result.append({
                'id': rec.id,
                'activity_id': rec.activity_id,
                'value': rec.value,
                'created_at': rec.created_at.isoformat(),
                'unit': rec.activity.unit.value if rec.activity and rec.activity.unit else None,
                'activity_category': rec.activity.category.name if rec.activity and rec.activity.category else None,
                'activity_category_id': rec.activity.category.id if rec.activity and rec.activity.category else None,
                'activity_name': rec.activity.name if rec.activity else None,
                'activity_group': rec.activity.category.group.name if rec.activity.category.group else None,
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@record_bp.route('/api/records', methods=['POST'])
def create_record():
    data = request.get_json()
    # 必要なフィールドが存在するか確認
    if not data or 'activity_id' not in data or 'value' not in data:
        return jsonify({'error': 'activity_id と value は必須です'}), 400

    try:
        new_record = Record(
            activity_id=data['activity_id'],
            value=data['value']
            # created_at は Record モデル側で default=datetime.datetime.utcnow などになっている前提
        )
        db.session.add(new_record)
        db.session.commit()
        return jsonify({'message': 'Record created', 'id': new_record.id}), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@record_bp.route('/api/records/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400

    record = Record.query.get(record_id)
    if record is None:
        return jsonify({'error': 'Record not found'}), 404

    try:
        if 'value' in data: # valueのみ更新可能
            record.value = data['value']
        db.session.commit()
        return jsonify({'message': 'Record updated'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@record_bp.route('/api/records/<int:record_id>', methods=['DELETE'])
def delete_record(record_id):
    record = Record.query.get(record_id)
    if record is None:
        return jsonify({'error': 'Record not found'}), 404

    try:
        db.session.delete(record)
        db.session.commit()
        return jsonify({'message': 'Record deleted'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500