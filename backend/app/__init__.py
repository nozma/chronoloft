import os
import secrets
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()

def create_app():
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
    frontend_dist = os.path.join(BASE_DIR, 'frontend', 'dist')

    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder=frontend_dist,
        static_url_path='',
        template_folder=frontend_dist
    )
    
    app.instance_path = os.path.join(BASE_DIR, 'backend', 'instance')
    
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", secrets.token_hex(16)),
        SQLALCHEMY_DATABASE_URI='sqlite:///' + os.path.join(app.instance_path, 'app.db'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False
    )

    # instance フォルダが存在しない場合は作成する
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # CORSの有効化
    CORS(app)

    # SQLAlchemyの初期化
    db.init_app(app)

    # Blueprintの登録
    from .routes import register_routes
    register_routes(app)
    
    @app.route("/")
    def index():
        return app.send_static_file("index.html")
    
    return app