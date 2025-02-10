from flask import Blueprint, request, jsonify
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
                # group は Enum で定義しているので、value を返す
                'group': cat.group.value if cat.group else None
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@category_bp.route('/api/categories', methods=['POST'])
def add_category():
    data = request.get_json()
    if not data or 'name' not in data or 'group' not in data:
        return jsonify({'error': '必要な情報が不足しています'}), 400

    try:
        # ActivityGroup の Enum にキャストする
        try:
            group_value = ActivityGroup(data['group'])
        except ValueError:
            return jsonify({'error': 'group の値が不正です'}), 400

        new_category = Category(name=data['name'], group=group_value)
        db.session.add(new_category)
        db.session.commit()
        return jsonify({'message': 'Category created', 'id': new_category.id}), 201
    except SQLAlchemyError as e:
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
            try:
                category.group = ActivityGroup(data['group'])
            except ValueError:
                return jsonify({'error': 'group の値が不正です'}), 400
        db.session.commit()
        return jsonify({'message': 'Category updated'}), 200
    except SQLAlchemyError as e:
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
        db.session.rollback()
        return jsonify({'error': str(e)}), 500