from flask import Blueprint
from .activity_routes import activity_bp
from .category_routes import category_bp
from .record_routes import record_bp

def register_routes(app):
    app.register_blueprint(activity_bp)
    app.register_blueprint(category_bp)
    app.register_blueprint(record_bp)