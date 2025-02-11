from flask import Blueprint, jsonify
from app.models import ActivityGroup

activity_group_bp = Blueprint('activity_group', __name__, url_prefix='/api/activity_groups')

@activity_group_bp.route('/', methods=['GET'])
def get_activity_groups():
    groups = ActivityGroup.query.all()
    # 例として、各グループの id, name, client_id を返す
    result = [{
        'id': group.id,
        'name': group.name,
        'client_id': group.client_id
    } for group in groups]
    return jsonify(result)