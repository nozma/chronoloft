import os
import secrets
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    
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

    # 設定の読み込み
    #app.config.from_pyfile('../instance/config.py', silent=True)
    
    # Blueprintの登録
    from .routes import register_routes
    register_routes(app)
    
    return app