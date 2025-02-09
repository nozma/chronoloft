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
                'activity_group': rec.activity.category.group.value if rec.activity and rec.activity.category and rec.activity.category.group else None,
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# PUT /api/records/<int:record_id>: レコードの更新
@record_bp.route('/api/records/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400

    record = Record.query.get(record_id)
    if record is None:
        return jsonify({'error': 'Record not found'}), 404

    try:
        # ここでは value の更新のみを例としています
        if 'value' in data:
            record.value = data['value']
        # 必要に応じて他のフィールドも更新可能にする
        db.session.commit()
        return jsonify({'message': 'Record updated'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# DELETE /api/records/<int:record_id>: レコードの削除
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