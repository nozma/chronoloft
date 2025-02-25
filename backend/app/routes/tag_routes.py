from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.exc import SQLAlchemyError
from app.models import Tag, db

tag_bp = Blueprint('tag', __name__, url_prefix='/api/tags')

@tag_bp.route('/', methods=['GET'])
def get_tags():
    try:
        tags = Tag.query.all()
        result = []
        for t in tags:
            result.append({
                'id': t.id,
                'name': t.name,
                'color': t.color
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in get_tags: %s", e, exc_info=True)
        return jsonify({'error': str(e)}), 500

@tag_bp.route('/', methods=['POST'])
def create_tag():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Tag name is required'}), 400
    
    new_tag = Tag(name=data['name'], color=data.get('color'))
    try:
        db.session.add(new_tag)
        db.session.commit()
        return jsonify({'message': 'Tag created', 'id': new_tag.id}), 201
    except SQLAlchemyError as e:
        current_app.logger.error("Error in create_tag: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tag_bp.route('/<int:tag_id>', methods=['PUT'])
def update_tag(tag_id):
    data = request.get_json()
    tag = Tag.query.get(tag_id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404

    if 'name' in data:
        tag.name = data['name']
    if 'color' in data:
        tag.color = data['color']

    try:
        db.session.commit()
        return jsonify({'message': 'Tag updated'})
    except SQLAlchemyError as e:
        current_app.logger.error("Error in update_tag: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tag_bp.route('/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    tag = Tag.query.get(tag_id)
    if not tag:
        return jsonify({'error': 'Tag not found'}), 404

    try:
        db.session.delete(tag)
        db.session.commit()
        return jsonify({'message': 'Tag deleted'})
    except SQLAlchemyError as e:
        current_app.logger.error("Error in delete_tag: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500