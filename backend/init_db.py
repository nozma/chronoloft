from app import create_app, db
from app.models import Activity, Record, ActivityGroup, ActivityUnitType
import datetime
import os
from dotenv import load_dotenv

app = create_app()

with app.app_context():
    # データベースファイルのパスを取得
    load_dotenv()
    db_file = os.environ.get("APP_DB_PATH", os.path.join(app.instance_path, 'app.db'))
    db_file = os.path.expanduser(db_file)

    if os.path.exists(db_file):
        print("Database already exists. Skipping initialization.")
    else:
        # データベースが存在しない場合のみ、テーブル作成とサンプルデータの挿入を実行
        db.create_all()

        # グループの生成
        study = ActivityGroup(name="study")
        game = ActivityGroup(name="game")
        workout = ActivityGroup(name="workout")
        db.session.add_all([study, game, workout])
        db.session.commit()

        # サンプルアクティビティの作成（group_id を直接指定）
        activity1 = Activity(
            name="Duolingo",
            group_id=study.id,
            unit=ActivityUnitType.MINUTES,
            asset_key="duolingo"
        )
        activity2 = Activity(
            name="現代数理統計学",
            group_id=study.id,
            unit=ActivityUnitType.MINUTES,
            asset_key="mmtakemura"
        )
        activity3 = Activity(
            name="スプラトゥーン3",
            group_id=game.id,
            unit=ActivityUnitType.MINUTES,
            asset_key="splatoon3"
        )
        activity4 = Activity(
            name="プッシュアップ",
            group_id=workout.id,
            unit=ActivityUnitType.COUNT
        )
        db.session.add_all([activity1, activity2, activity3, activity4])
        db.session.commit()

        # サンプルレコードの作成
        now = datetime.datetime.utcnow()
        record1 = Record(
            activity_id=activity1.id,
            value=10.1,
            created_at=now
        )
        record2 = Record(
            activity_id=activity2.id,
            value=61.2,
            created_at=now + datetime.timedelta(days=-1)
        )
        record3 = Record(
            activity_id=activity3.id,
            value=90,
            created_at=now + datetime.timedelta(days=-2)
        )
        record4 = Record(
            activity_id=activity4.id,
            value=5,
            created_at=now + datetime.timedelta(days=-3)
        )
        db.session.add_all([record1, record2, record3, record4])
        db.session.commit()

        print("Database initialized with sample data.")