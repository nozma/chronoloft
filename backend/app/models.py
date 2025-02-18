from . import db
import datetime
import enum

class ActivityUnitType(enum.Enum):
    COUNT = "count"
    MINUTES = "minutes"

class ActivityGroup(db.Model):
    """
    アクティビティのグループを管理するモデル。
    
    Attributes:
        id (int): 自動採番される主キー。
        name (str): グループ名。
        client_id (str): Discord連携に使うClient ID。
    """
    __tablename__ = 'activity_group'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    client_id = db.Column(db.String(50), unique=True)
    icon_name = db.Column(db.String(50), nullable=True)
    
    def __repr__(self):
        return f"<ActivityGroup name={self.name} client_id={self.client_id}>"

class Activity(db.Model):
    """
    アクティビティの項目を記録するモデル。

    Attributes:
        id (int): 自動採番される主キー。
        is_active (bool): 項目が有効(選択可能)であるかどうかを表す真偽値。デフォルトはTrue。
        name (str): アクティビティの名称（例: "勉強", "運動"）。
        category_id (int): 関連する Category の外部キー。
        unit (enum): アクティビティの記録単位(回数または経過時間)。
        asset_key (str): Discord Developer Portalで設定した画像に対応するアセットキー。
        created_at (datetime): アクティビティ作成日時。デフォルトは現在時刻。
    """
    id = db.Column(db.Integer, primary_key=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    category = db.relationship('Category', back_populates='activities')
    unit = db.Column(db.Enum(ActivityUnitType), nullable=True)
    asset_key = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    records = db.relationship('Record', back_populates='activity', lazy=True)

    def __repr__(self):
        unit_value = self.unit.value if self.unit is not None else None
        return f"<Activity id={self.id} name={self.name} unit={unit_value} category_id={self.category_id}>"

class Category(db.Model):
    """
    カテゴリーを記録するモデル。

    Attributes:
        id (int): 自動採番される主キー。
        name (str): カテゴリーの名称(例: "英語", "数学")。
        group_id: アクティビティグループのid。
    """
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('activity_group.id'), nullable=False)
    group = db.relationship('ActivityGroup', backref='categories')
    
    activities = db.relationship('Activity', back_populates='category', lazy=True)

    def __repr__(self):
        return f"<Category id={self.id} name={self.name}>"

class Record(db.Model):
    """
    アクティビティのレコードを記録するモデル。

    Attributes:
        id (int): 自動採番される主キー。
        activity_id (int): 記録の対象のアクティビティのid(外部キー)。
        value (float): アクティビティの時間または回数を表す実数。
        created_at (datetime): アクティビティ作成日時または開始時刻。デフォルトは現在日時。
    """
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('activity.id'), nullable=False)
    activity = db.relationship('Activity', back_populates='records')
    value = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Record id={self.id}>"

