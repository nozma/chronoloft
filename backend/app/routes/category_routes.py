from flask import Blueprint, request, jsonify, current_app
from ..models import Category, ActivityGroup
from .. import db
from sqlalchemy.exc import SQLAlchemyError

category_bp = Blueprint('category', __name__)

@category_bp.route('/api/categories', methods=['GET'])
def get_categories():
    try:
        categories = Category.query.all()
        result = []
        for cat in categories:
            result.append({
                'id': cat.id,
                'name': cat.name,
                'group_id': cat.group_id,
                'group_name': cat.group.name if cat.group else None
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in add_category: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@category_bp.route('/api/categories', methods=['POST'])
def add_category():
    data = request.get_json()
    if not data or 'name' not in data or 'group' not in data:
        return jsonify({'error': '必要な情報が不足しています'}), 400

    try:
        # 既存の ActivityGroup を、グループ名で検索する
        group_value = ActivityGroup.query.filter_by(name=data['group']).first()
        if not group_value:
            return jsonify({'error': '指定されたグループが存在しません'}), 400

        new_category = Category(name=data['name'], group=group_value)
        db.session.add(new_category)
        db.session.commit()
        return jsonify({'message': 'Category created', 'id': new_category.id}), 201
    except SQLAlchemyError as e:
        current_app.logger.error("Error in add_category: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@category_bp.route('/api/categories/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400

    category = Category.query.get(category_id)
    if category is None:
        return jsonify({'error': 'Category not found'}), 404

    try:
        if 'name' in data:
            category.name = data['name']
        if 'group' in data:
            # 既存の ActivityGroup をグループ名で検索する
            group_value = ActivityGroup.query.filter_by(name=data['group']).first()
            if not group_value:
                return jsonify({'error': '指定されたグループが存在しません'}), 400
            category.group = group_value
        db.session.commit()
        return jsonify({'message': 'Category updated'}), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in add_category: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@category_bp.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    category = Category.query.get(category_id)
    if category is None:
        return jsonify({'error': 'Category not found'}), 404

    try:
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Category deleted'}), 200
    except SQLAlchemyError as e:
        current_app.logger.error("Error in add_category: %s", e, exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500