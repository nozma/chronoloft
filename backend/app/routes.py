from flask import Blueprint, jsonify

bp = Blueprint('main', __name__)

@bp.route('/api/hello')
def hello():
    return jsonify(message="Hello, Activity Tracker!")