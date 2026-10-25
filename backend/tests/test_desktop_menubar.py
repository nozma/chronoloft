"""表示の副作用、端末の分離、終了直前の競合を検証する。"""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.app import create_app, db
from backend.app.models import Activity, ActivityGroup, ActivityUnitType, LocalSetting
from backend.app.routes import stopwatch_routes
from backend.desktop_menubar import elapsed_title, prepare_desktop_termination, read_desktop_state


class MenuBarTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'})
        self.addCleanup(self.app.extensions['lan_auth_db'].close)
        with self.app.app_context():
            db.create_all()
            group = ActivityGroup(name='読書', icon_name='MenuBookIcon')
            activity = Activity(name='本', group=group, unit=ActivityUnitType.MINUTES)
            db.session.add(activity)
            db.session.commit()
            self.activity_id = activity.id
        self.addCleanup(self.cleanup_database)
        self.client = self.app.test_client()
        self.device_id = str(uuid.uuid4())
        self.client.put('/api/stopwatch-devices/' + self.device_id, json={'name': 'アプリ'})
        self.sync = patch.object(stopwatch_routes, 'sync_discord', return_value=None)
        self.mock_sync = self.sync.start()
        self.addCleanup(self.sync.stop)

    def cleanup_database(self):
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

    def start(self, device_id=None, slot='main'):
        return self.client.post('/api/stopwatches', json={
            'id': str(uuid.uuid4()), 'device_id': device_id or self.device_id,
            'activity_id': self.activity_id, 'slot': slot,
        }).json['item']

    def test_read_is_side_effect_free_and_ignores_other_devices_and_sub(self):
        other_id = str(uuid.uuid4())
        self.client.put('/api/stopwatch-devices/' + other_id, json={'name': 'ブラウザー'})
        self.start(other_id)
        self.start(slot='sub')
        self.assertIsNone(read_desktop_state(self.app, self.device_id)['session'])
        item = self.start()
        self.mock_sync.reset_mock()
        for _ in range(2):
            state = read_desktop_state(self.app, self.device_id)
            self.assertEqual(state['session']['id'], item['id'])
            self.assertEqual(state['session']['icon'], 'MenuBookIcon')
        self.mock_sync.assert_not_called()

    def test_elapsed_is_truncated_cumulative_and_pauses_during_confirmation(self):
        session = {'started_at': 1000, 'paused_at': None}
        self.assertEqual(elapsed_title(session, 60999), '00:00')
        self.assertEqual(elapsed_title(session, 61000), '00:01')
        self.assertEqual(elapsed_title(session, 1000 + (25 * 60 + 30) * 60000), '25:30')
        session['paused_at'] = 61000
        self.assertEqual(elapsed_title(session, 999999999), '00:01')
        self.assertEqual(elapsed_title(session, 0), '00:01')
        self.assertEqual(elapsed_title(None), '')

    def test_dock_setting_is_validated_persisted_and_read_without_a_device(self):
        self.assertFalse(read_desktop_state(self.app, None)['show_dock'])
        self.assertEqual(self.client.patch('/api/settings/local', json={'showDockIcon': True}).status_code, 200)
        self.assertTrue(read_desktop_state(self.app, None)['show_dock'])
        self.assertEqual(self.client.patch('/api/settings/local', json={'showDockIcon': 'false'}).status_code, 400)
        self.assertTrue(read_desktop_state(self.app, None)['show_dock'])

    def test_exit_rechecks_own_main_and_blocks_new_changes_after_finishing(self):
        item = self.start()
        self.assertFalse(prepare_desktop_termination(self.app, self.device_id))
        item = self.client.post(f"/api/stopwatches/{item['id']}/confirm", json={'revision': item['revision']}).json['item']
        self.assertFalse(prepare_desktop_termination(self.app, self.device_id))
        self.client.post(f"/api/stopwatches/{item['id']}/complete", json={'revision': item['revision']})
        self.assertTrue(prepare_desktop_termination(self.app, self.device_id))
        self.assertEqual(self.client.post('/api/stopwatches', json={}).status_code, 503)
        self.app.extensions['desktop_update_gate'].cancel()
        self.assertEqual(self.client.post('/api/stopwatches', json={}).status_code, 400)

    def test_other_device_and_sub_sessions_are_not_finished_on_app_exit(self):
        other_id = str(uuid.uuid4())
        self.client.put('/api/stopwatch-devices/' + other_id, json={'name': 'ブラウザー'})
        self.start(other_id)
        self.start(slot='sub')
        self.assertTrue(prepare_desktop_termination(self.app, self.device_id))

    def test_unbound_desktop_waits_until_its_existing_main_is_identified(self):
        self.assertTrue(prepare_desktop_termination(self.app, None))
        self.app.extensions['desktop_update_gate'].cancel()
        item = self.start()
        self.assertFalse(prepare_desktop_termination(self.app, None))
        self.assertFalse(self.app.extensions['desktop_update_gate'].pending)
        self.client.post(f"/api/stopwatches/{item['id']}/confirm", json={'revision': item['revision']})
        self.assertFalse(prepare_desktop_termination(self.app, None))
