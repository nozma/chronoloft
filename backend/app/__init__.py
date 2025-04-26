import os
import secrets
import sys
import logging
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from sqlalchemy import MetaData
from platformdirs import PlatformDirs

# ====================================
# Flask-SQLAlchemy の設定
# ====================================
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}
metadata = MetaData(naming_convention=naming_convention)
db = SQLAlchemy(metadata=metadata)

# ====================================
# OS推奨ディレクトリにDBを配置
# ====================================
def get_os_db_path():
    """
    OS推奨のユーザーデータディレクトリに「app.db」を配置するパスを返す。
    Windows: %APPDATA%/Actiloft/
    macOS:   ~/Library/Application Support/Actiloft/
    Linux:   ~/.local/share/Actiloft/
    """
    dirs = PlatformDirs("Actiloft")
    db_dir = dirs.user_data_dir
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "app.db")

# ====================================
# Flaskアプリ生成
# ====================================
def create_app():
    # ログ設定
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s'
    )

    # PyInstaller でバンドルした際、_MEIPASS にフロントエンドのdistなどが入る
    if hasattr(sys, '_MEIPASS'):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))

    frontend_dist = os.path.join(base_dir, 'frontend', 'dist')

    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder=frontend_dist,
        static_url_path='',
        template_folder=frontend_dist
    )

    # DBパスは OS推奨ディレクトリに強制配置
    db_path = get_os_db_path()

    # SECRET_KEY は都度ランダム生成 (再起動で変わる)
    app.config.from_mapping(
        SECRET_KEY=secrets.token_hex(16),
        SQLALCHEMY_DATABASE_URI='sqlite:///' + os.path.abspath(db_path),
        SQLALCHEMY_TRACK_MODIFICATIONS=False
    )

    # instanceフォルダ（Flaskのinstance_path）を作成
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass

    # CORSとDBを初期化
    CORS(app)
    db.init_app(app)

    # Flask-Migrate
    migrate = Migrate(app, db)

    # Blueprint登録
    from .routes import register_routes
    register_routes(app)

    # エラーハンドラ
    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.error("Unhandled Exception: %s", str(e), exc_info=True)
        return jsonify({"error": "An internal error occurred."}), 500

    # ルート
    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    return app