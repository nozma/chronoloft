from flask import Blueprint, request, jsonify, current_app
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
            tag_list = []
            if rec.activity and rec.activity.tags:
                tag_list = [{
                    "id": t.id,
                    "name": t.name,
                    "color": t.color
                } for t in rec.activity.tags]
            result.append({
                'id': rec.id,
                'activity_id': rec.activity_id,
                'value': rec.value,
                'created_at': rec.created_at.isoformat(),
                'unit': rec.activity.unit.value if rec.activity and rec.activity.unit else None,
                'activity_name': rec.activity.name if rec.activity else None,
                'activity_group': rec.activity.group.name if rec.activity and rec.activity.group else None,
                'activity_group_id': rec.activity.group_id if rec.activity else None,
                'tags': tag_list,
                'memo': rec.memo
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_records: %s", e, exc_info=True)
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
            value=data['value'],
            # created_at は Record モデル側で default=datetime.datetime.utcnow などになっている前提
            memo=data.get('memo')
        )
        db.session.add(new_record)
        db.session.commit()
        return jsonify({'message': 'Record created', 'id': new_record.id}), 201
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_records: %s", e, exc_info=True)
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
        if 'activity_id' in data:
            record.activity_id = data['activity_id']
        if 'value' in data:
            record.value = data['value']
        if 'created_at' in data:
            import datetime
            # ここでは ISO 8601 形式で送信されることを前提とする
            record.created_at = datetime.datetime.fromisoformat(data['created_at'])
        if 'memo' in data:
            record.memo = data['memo']
        db.session.commit()
        return jsonify({'message': 'Record updated'}), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_records: %s", e, exc_info=True)
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
        current_app.logger.error("Error in get_records: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500