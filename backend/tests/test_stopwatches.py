import uuid
import datetime
from unittest.mock import patch

from test_backend import DatabaseTestCase
from app import db
from app.models import Activity, ActivityUnitType, Record, StopwatchSession
from app.routes import stopwatch_routes


class StopwatchTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.remote = self.app.test_client()
        self.options = dict(base_url='http://192.168.1.10:5180',
                            environ_overrides={'REMOTE_ADDR': '192.168.1.20'},
                            headers={'X-Chronoloft': '1'})
        self.client.put('/api/lan/settings', json=dict(enabled=True, password='test-password'))
        self.remote.post('/api/auth/login', json=dict(password='test-password'), **self.options)
        self.local_id = str(uuid.uuid4())
        self.remote_id = str(uuid.uuid4())
        self.client.put('/api/stopwatch-devices/' + self.local_id, json=dict(name='作業PC'))
        self.remote.put('/api/stopwatch-devices/' + self.remote_id, json=dict(name='スマートフォン'), **self.options)
        self.discord = patch.object(stopwatch_routes, 'sync_discord', return_value=None)
        self.sync = self.discord.start()
        self.addCleanup(self.discord.stop)

    def start(self, remote=False, **kwargs):
        data = dict(id=str(uuid.uuid4()), device_id=self.remote_id if remote else self.local_id,
                    activity_id=self.activity_id, discord_enabled=True)
        data.update(kwargs)
        return (self.remote if remote else self.client).post('/api/stopwatches', json=data,
                                                           **(self.options if remote else {}))

    def operate(self, item, action, remote=False, **kwargs):
        return (self.remote if remote else self.client).post(
            f"/api/stopwatches/{item['id']}/{action}", json=dict(revision=item['revision'], **kwargs),
            **(self.options if remote else {}))

    def test_independent_devices_and_remote_control(self):
        local = self.start().json['item']
        remote = self.start(True).json['item']
        self.assertTrue(local['discord_enabled'])
        self.assertFalse(remote['discord_enabled'])
        self.assertEqual(len(self.client.get('/api/stopwatches').json['items']), 2)
        result = self.operate(local, 'complete', remote=True)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(Record.query.count(), 1)
        self.assertEqual(self.client.get('/api/stopwatches').json['items'][0]['id'], remote['id'])

    def test_complete_retry_is_idempotent_and_cannot_resurrect(self):
        item = self.start().json['item']
        first = self.operate(item, 'complete').json['item']
        second = self.operate(item, 'complete', True).json['item']
        self.assertEqual(first['record_id'], second['record_id'])
        self.assertEqual(Record.query.count(), 1)
        replay = self.start(id=item['id']).json['item']
        self.assertEqual(replay['status'], 'completed')
        self.assertEqual(self.client.get('/api/stopwatches').json['items'], [])

    def test_conflict_does_not_overwrite_or_save(self):
        item = self.start().json['item']
        edited = self.operate(item, 'edit', True, memo='別端末で編集')
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(self.operate(item, 'complete').status_code, 409)
        self.assertEqual(self.operate(item, 'edit', memo='古い編集').status_code, 409)
        self.assertEqual(Record.query.count(), 0)
        self.assertEqual(self.client.get('/api/stopwatches').json['items'][0]['memo'], '別端末で編集')

    def test_confirmation_resume_includes_confirmation_time(self):
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000000):
            item = self.start().json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000060):
            confirming = self.operate(item, 'confirm').json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000120):
            resumed = self.operate(confirming, 'resume').json['item']
        self.assertEqual(resumed['started_at'], item['started_at'])
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000180):
            self.operate(resumed, 'complete')
        self.assertEqual(Record.query.one().value, 3)

    def test_confirmation_save_uses_snapshot_and_edited_values(self):
        item = self.start(started_at=1700000000000).json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000060):
            item = self.operate(item, 'confirm').json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000180):
            self.operate(item, 'complete', memo='確認済み', value=2.5, created_at='2026-10-21T10:00:00+09:00')
        record = Record.query.one()
        self.assertEqual((record.value, record.memo, record.created_at.hour), (2.5, '確認済み', 1))

    def test_cancel_is_idempotent_and_frees_slot(self):
        item = self.start().json['item']
        self.assertEqual(self.start().status_code, 409)
        self.assertEqual(self.operate(item, 'cancel').status_code, 200)
        self.assertEqual(self.operate(item, 'cancel').status_code, 200)
        self.assertEqual(self.operate(item, 'complete').status_code, 409)
        self.assertEqual(self.start().status_code, 201)
        self.assertEqual(Record.query.count(), 0)

    def test_remote_cannot_claim_host_or_enable_discord(self):
        result = self.remote.put('/api/stopwatch-devices/' + self.local_id, json=dict(name='偽装'), **self.options)
        self.assertEqual(result.status_code, 409)
        self.assertEqual(self.start(True, device_id=self.local_id).status_code, 403)
        remote = self.start(True).json['item']
        self.assertEqual(self.operate(remote, 'edit', True, discord_enabled=True).status_code, 403)
        self.assertEqual(self.remote.post('/api/discord_presence/start', json={}, **self.options).status_code, 403)
        self.remote.post('/api/auth/logout', **self.options)
        self.assertEqual(self.remote.get('/api/stopwatches', **self.options).status_code, 401)

    def test_invalid_inputs_leave_timer_unchanged(self):
        item = self.start().json['item']
        for action, data in [('edit', dict(started_at=float('inf'))), ('complete', dict(value=-1)),
                             ('complete', dict(created_at='bad')), ('edit', dict(memo=123))]:
            with self.subTest(action=action, data=data):
                self.assertEqual(self.operate(item, action, **data).status_code, 400)
        self.assertEqual(Record.query.count(), 0)
        self.assertEqual(db.session.get(StopwatchSession, item['id']).status, 'running')

    def test_migration_retains_id_start_memo_and_confirmation(self):
        result = self.start(id=str(uuid.uuid4()), started_at=1700000000000,
                            paused_at=1700000060000, memo='旧計測')
        self.assertEqual(result.status_code, 201)
        item = result.json['item']
        self.assertEqual((item['status'], item['started_at'], item['memo']), ('confirming', 1700000000000, '旧計測'))

    def test_remote_timer_never_calls_discord_and_host_remote_control_does(self):
        self.discord.stop()
        with patch.object(stopwatch_routes.discord_routes, 'discord_presence_start') as start, \
             patch.object(stopwatch_routes.discord_routes, 'discord_presence_stop') as stop:
            remote = self.start(True).json['item']
            self.operate(remote, 'edit', True, memo='端末の計測')
            self.operate(remote, 'complete', True)
            start.assert_not_called()
            stop.assert_not_called()
            start.return_value = (self.app.response_class('{}', mimetype='application/json'), 200)
            local = self.start(memo='公開しない詳細').json['item']
            self.assertEqual(start.call_args.args[0]['session_id'], local['id'])
            self.assertNotIn('details', start.call_args.args[0])
            edited = self.operate(local, 'edit', True, memo='PCを遠隔操作').json['item']
            self.assertEqual(edited['memo'], 'PCを遠隔操作')
            self.assertNotIn('details', start.call_args.args[0])
        self.discord.start()

    def test_memo_is_saved_but_never_published_on_start_poll_edit_or_resume(self):
        self.discord.stop()
        with patch('app.discord_presence_manager.Presence') as presence:
            item = self.start(memo='公開しない詳細').json['item']

            def assert_private():
                self.assertTrue(presence.return_value.update.called)
                for call in presence.return_value.update.call_args_list:
                    activity = call.kwargs['payload_override']['args']['activity']
                    self.assertEqual(activity['details'], '0時間0分/30日')
                    self.assertNotIn('公開しない詳細', str(activity))

            assert_private()
            self.app.extensions['stopwatch_discord_sync'] = 0
            self.assertEqual(self.client.get('/api/stopwatches').status_code, 200)
            assert_private()
            item = self.operate(item, 'edit', memo='公開しない詳細の変更').json['item']
            self.assertEqual(item['memo'], '公開しない詳細の変更')
            assert_private()
            item = self.operate(item, 'confirm').json['item']
            item = self.operate(item, 'resume').json['item']
            assert_private()
            self.operate(item, 'complete')
            self.assertEqual(Record.query.one().memo, '公開しない詳細の変更')
        self.discord.start()

    def test_recent_time_uses_session_activity_and_refreshes_on_poll(self):
        activity = db.session.get(Activity, self.activity_id)
        duplicate = Activity(name=activity.name, group=activity.group, unit=ActivityUnitType.MINUTES)
        db.session.add(duplicate)
        db.session.flush()
        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        db.session.add_all([
            Record(activity_id=self.activity_id, value=30, created_at=now),
            Record(activity_id=self.activity_id, value=6000, created_at=now - datetime.timedelta(days=31)),
            Record(activity_id=duplicate.id, value=6000, created_at=now),
        ])
        db.session.commit()
        self.discord.stop()
        with patch('app.discord_presence_manager.Presence') as presence:
            self.assertEqual(self.start(memo='公開しない文章').status_code, 201)
            payload = presence.return_value.update.call_args.kwargs['payload_override']
            self.assertEqual(payload['args']['activity']['details'], '0時間30分/30日')
            db.session.add(Record(activity_id=self.activity_id, value=30, created_at=now))
            db.session.commit()
            self.app.extensions['stopwatch_discord_sync'] = 0
            self.assertEqual(self.client.get('/api/stopwatches').status_code, 200)
            payload = presence.return_value.update.call_args.kwargs['payload_override']
            self.assertEqual(payload['args']['activity']['details'], '1時間0分/30日')
            self.assertNotIn('公開しない文章', str(payload))
        self.discord.start()

    def test_contiguous_records_with_same_memo_keep_existing_merge_behavior(self):
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000000):
            first = self.start(memo='読書').json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000060):
            result = self.operate(first, 'complete').json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000120):
            second = self.start(memo='読書').json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000180):
            merged = self.operate(second, 'complete').json['item']
        self.assertEqual(result['record_id'], merged['record_id'])
        self.assertEqual(Record.query.count(), 1)
        self.assertEqual(Record.query.one().value, 3)

    def test_parallel_finishes_save_once(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        item = self.start().json['item']
        barrier = Barrier(2)

        def finish():
            with self.app.test_client() as client:
                barrier.wait(timeout=5)
                return client.post(f"/api/stopwatches/{item['id']}/complete", json=dict(revision=item['revision'])).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: finish(), range(2)))
        self.assertEqual(results, [200, 200])
        db.session.expire_all()
        self.assertEqual(Record.query.count(), 1)

    def test_active_activity_is_protected_from_other_device_edits(self):
        item = self.start().json['item']
        self.assertEqual(self.remote.delete(f'/api/activities/{self.activity_id}', **self.options).status_code, 409)
        self.assertEqual(self.remote.put(f'/api/activities/{self.activity_id}', json=dict(unit='count'), **self.options).status_code, 409)
        self.assertEqual(self.operate(item, 'complete').status_code, 200)

    def test_save_failure_rolls_back_record_and_session_together(self):
        from sqlalchemy.exc import SQLAlchemyError
        item = self.start().json['item']
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('保存失敗')):
            with self.assertLogs(self.app.logger, level='ERROR'):
                self.assertEqual(self.operate(item, 'complete').status_code, 500)
        self.assertEqual(Record.query.count(), 0)
        db.session.expire_all()
        stored = db.session.get(StopwatchSession, item['id'])
        self.assertEqual((stored.status, stored.revision), ('running', item['revision']))
        self.assertEqual(self.operate(item, 'complete').status_code, 200)

    def test_overlapping_device_records_remain_separate(self):
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000000):
            local = self.start().json['item']
            remote = self.start(True).json['item']
        with patch('app.routes.stopwatch_routes.time.time', return_value=1700000060):
            self.operate(local, 'complete')
            self.operate(remote, 'complete', True)
        self.assertEqual(Record.query.count(), 2)

    def test_startup_upgrades_older_table_without_losing_measurements(self):
        from sqlalchemy import inspect
        session_id = str(uuid.uuid4())
        with db.engine.begin() as connection:
            connection.exec_driver_sql('DROP TABLE stopwatch_session')
            connection.exec_driver_sql('''CREATE TABLE stopwatch_session (
                id VARCHAR(36) PRIMARY KEY, device_id VARCHAR(36) NOT NULL,
                slot VARCHAR(8) NOT NULL, activity_id INTEGER NOT NULL,
                started_at FLOAT NOT NULL, paused_at FLOAT, memo TEXT NOT NULL,
                status VARCHAR(12) NOT NULL, revision INTEGER NOT NULL,
                discord_enabled BOOLEAN NOT NULL, record_id INTEGER)''')
            connection.exec_driver_sql(
                'INSERT INTO stopwatch_session VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (session_id, self.local_id, 'main', self.activity_id, 1700000000000,
                 1700000060000, '移行前のメモ', 'confirming', 3, False, None))
        stopwatch_routes.initialize_stopwatch_tables()
        stopwatch_routes.initialize_stopwatch_tables()
        self.assertIn('active_key', {column['name'] for column in inspect(db.engine).get_columns('stopwatch_session')})
        response = self.client.get('/api/stopwatches')
        self.assertEqual(response.status_code, 200)
        item = response.json['items'][0]
        self.assertEqual((item['id'], item['memo'], item['revision'], item['status']),
                         (session_id, '移行前のメモ', 3, 'confirming'))
        self.assertEqual(db.session.get(StopwatchSession, session_id).active_key, self.local_id + ':main')
        self.assertEqual(self.start().status_code, 409)
        self.assertEqual(self.operate(item, 'complete').status_code, 200)
        self.assertEqual(Record.query.one().memo, '移行前のメモ')
        self.assertEqual(self.start().status_code, 201)

    def test_polling_reports_discord_failure_and_clears_it_on_recovery(self):
        self.start()
        self.app.extensions['stopwatch_discord_sync'] = 0
        self.sync.return_value = 'Failed to connect to Discord'
        response = self.client.get('/api/stopwatches')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(response.json['discord_errors'].values()), ['Failed to connect to Discord'])
        self.assertEqual(len(response.json['items']), 1)
        self.app.extensions['stopwatch_discord_sync'] = 0
        self.sync.return_value = None
        self.assertEqual(self.client.get('/api/stopwatches').json['discord_errors'], {})

    def test_partial_schema_upgrade_completes_index_and_active_keys(self):
        from sqlalchemy import inspect
        with db.engine.begin() as connection:
            connection.exec_driver_sql('DROP TABLE stopwatch_session')
            connection.exec_driver_sql('''CREATE TABLE stopwatch_session (
                id VARCHAR(36) PRIMARY KEY, device_id VARCHAR(36) NOT NULL,
                slot VARCHAR(8) NOT NULL, active_key VARCHAR(48), activity_id INTEGER NOT NULL,
                started_at FLOAT NOT NULL, paused_at FLOAT, memo TEXT NOT NULL,
                status VARCHAR(12) NOT NULL, revision INTEGER NOT NULL,
                discord_enabled BOOLEAN NOT NULL, record_id INTEGER)''')
            connection.exec_driver_sql(
                'INSERT INTO stopwatch_session VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (str(uuid.uuid4()), self.local_id, 'main', None, self.activity_id,
                 1700000000000, None, '', 'running', 1, False, None))
        stopwatch_routes.initialize_stopwatch_tables()
        stopwatch_routes.initialize_stopwatch_tables()
        self.assertEqual(StopwatchSession.query.one().active_key, self.local_id + ':main')
        self.assertTrue(any(index['unique'] and index['column_names'] == ['active_key']
                            for index in inspect(db.engine).get_indexes('stopwatch_session')))

    def test_manual_discord_recovery_clears_cached_warning(self):
        item = self.start().json['item']
        self.discord.stop()
        self.app.extensions['stopwatch_discord_errors'] = {item['id']: '以前のエラー'}
        with patch.object(stopwatch_routes, '_sync_discord', return_value=None):
            self.assertEqual(self.operate(item, 'edit').status_code, 200)
        self.assertNotIn(item['id'], self.app.extensions['stopwatch_discord_errors'])
        self.discord.start()
