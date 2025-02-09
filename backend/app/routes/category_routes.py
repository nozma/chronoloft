from flask import Blueprint, request, jsonify
from ..models import Category, ActivityGroup
from .. import db

category_bp = Blueprint('category', __name__)

@category_bp.route('/api/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    result = []
    for cat in categories:
        result.append({
            'id': cat.id,
            'name': cat.name,
            'group': cat.group.value
        })
    return jsonify(result)

@category_bp.route('/api/categories', methods=['POST'])
def add_category():
    data = request.get_json()
    if not data or 'name' not in data or 'group' not in data:
        return jsonify({'error': '必要な情報が不足しています'}), 400
    try:
        group = ActivityGroup(data['group'])
    except ValueError:
        return jsonify({'error': 'group の値が不正です'}), 400
    new_category = Category(
        name=data['name'],
        group=group
    )
    db.session.add(new_category)
    db.session.commit()
    return jsonify({'message': 'Category created', 'id': new_category.id}), 201