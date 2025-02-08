from flask import Flask
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    # 設定の読み込み
    app.config.from_pyfile('../instance/config.py', silent=True)
    
    # ルーティングの登録
    @app.route('/api/hello')
    def hello():
        return {"message": "Hello, Activity Tracker!"}
    
    return app