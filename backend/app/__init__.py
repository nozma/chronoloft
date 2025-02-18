import os
import secrets
import sys
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
from flask_migrate import Migrate
from sqlalchemy import MetaData

naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}
metadata = MetaData(naming_convention=naming_convention)
db = SQLAlchemy(metadata=metadata)

def create_app():
    if hasattr(sys, '_MEIPASS'):
        base_dir = sys._MEIPASS
        env_path = os.path.join(base_dir, 'backend', '.env')
    else:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
        env_path = os.path.join(base_dir, 'backend', '.env')
    #BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
    
    load_dotenv(env_path)
    frontend_dist = os.path.join(base_dir, 'frontend', 'dist')

    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder=frontend_dist,
        static_url_path='',
        template_folder=frontend_dist
    )
    
    db_path = os.environ.get("APP_DB_PATH", os.path.join(app.instance_path, 'app.db'))
    db_path = os.path.expanduser(db_path)
    
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", secrets.token_hex(16)),
        SQLALCHEMY_DATABASE_URI='sqlite:///' + os.path.abspath(db_path),
        SQLALCHEMY_TRACK_MODIFICATIONS=False
    )
    
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass

    CORS(app)
    db.init_app(app)
    
    migrate = Migrate(app, db)

    from .routes import register_routes
    register_routes(app)
    
    @app.route("/")
    def index():
        return app.send_static_file("index.html")
    
    return app