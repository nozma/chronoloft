"""任意のよみがなの保存と入力制限を検証する。"""
from tests.test_backend import DatabaseTestCase
from app import db
from app.models import Activity
from app.routes.activity_routes import initialize_activity_reading


class ActivityReadingTests(DatabaseTestCase):
    def test_reading_crud_and_optional_value(self):
        activity = db.session.get(Activity, self.activity_id)
        group_id = activity.group_id
        response = self.client.post('/api/activities', json={'name': '追加', 'group_id': group_id})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(db.session.get(Activity, response.json['id']).reading, '')
        self.assertEqual(self.client.put(f'/api/activities/{self.activity_id}', json={'reading': 'どくしょ'}).status_code, 200)
        self.assertEqual(next(a for a in self.client.get('/api/activities').json if a['id'] == self.activity_id)['reading'], 'どくしょ')
        self.client.put(f'/api/activities/{self.activity_id}', json={'name': '別名'})
        self.assertEqual(activity.reading, 'どくしょ')
        self.client.put(f'/api/activities/{self.activity_id}', json={'reading': ''})
        self.assertEqual(activity.reading, '')

    def test_invalid_readings_do_not_change_data(self):
        group_id = db.session.get(Activity, self.activity_id).group_id
        for value in ['カナ', '漢字', 'romaji', 'ひら がな', 'あ\n', 'あ' * 161, None, 123]:
            with self.subTest(value=value):
                self.assertEqual(self.client.post('/api/activities', json={'name': '追加', 'group_id': group_id, 'reading': value}).status_code, 400)
                self.assertEqual(self.client.put(f'/api/activities/{self.activity_id}', json={'name': '変更', 'reading': value}).status_code, 400)
        self.assertEqual(db.session.get(Activity, self.activity_id).name, '読書')

    def test_existing_database_upgrade_is_repeatable(self):
        db.session.remove()
        with db.engine.begin() as connection:
            connection.exec_driver_sql('ALTER TABLE activity DROP COLUMN reading')
        initialize_activity_reading(self.app)
        initialize_activity_reading(self.app)
        self.assertEqual(db.session.get(Activity, self.activity_id).reading, '')
