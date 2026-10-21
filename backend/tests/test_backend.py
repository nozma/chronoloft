import datetime
import unittest
from unittest.mock import Mock, patch

from sqlalchemy.exc import SQLAlchemyError

from app import create_app, db
from app.models import Activity, ActivityGroup, ActivityUnitType, Record, Tag
from app import discord_presence_manager as rpc_module
from app.routes import discord_routes


TEST_CONFIG = {'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'}


class DatabaseTestCase(unittest.TestCase):
    def setUp(self):
        # 通常DBへの接近と実際のDiscord接続は、その時点で失敗させる。
        self.path_guard = patch('app.get_os_db_path', side_effect=AssertionError('通常DBへのアクセスは禁止'))
        self.path_guard.start()
        self.addCleanup(self.path_guard.stop)
        self.presence_guard = patch.object(rpc_module, 'Presence', side_effect=AssertionError('Discord実通信は禁止'))
        self.presence_guard.start()
        self.addCleanup(self.presence_guard.stop)
        self.app = create_app(TEST_CONFIG)
        self.addCleanup(self.app.extensions['lan_auth_db'].close)
        self.context = self.app.app_context()
        self.context.push()
        self.addCleanup(self.context.pop)
        self.addCleanup(self.cleanup_database)
        self.assertEqual(db.engine.url.database, ':memory:')
        db.create_all()
        self.client = self.app.test_client()
        group = ActivityGroup(name='学習', client_id='123456789')
        tag = Tag(name='本', color='#123456')
        activity = Activity(name='読書', group=group, unit=ActivityUnitType.MINUTES, tags=[tag])
        db.session.add(activity)
        db.session.commit()
        self.activity_id = activity.id
        # モジュールの共有状態もテスト間で分離する。
        self.manager_patch = patch.object(discord_routes, 'DISCORD_MANAGERS', {})
        self.manager_patch.start()
        self.sessions_patch = patch.object(discord_routes, 'DISCORD_SESSIONS', {})
        self.sessions_patch.start()
        self.addCleanup(self.sessions_patch.stop)
        self.addCleanup(self.manager_patch.stop)
        self.instance_patch = patch.object(rpc_module, '_instance', None)
        self.instance_patch.start()
        self.addCleanup(self.instance_patch.stop)

    def cleanup_database(self):
        db.session.remove()
        db.engine.dispose()

    def make_record(self, memo='資料を読む'):
        record = Record(activity_id=self.activity_id, value=30, memo=memo,
                        created_at=datetime.datetime(2026, 10, 13, 9, 0))
        db.session.add(record)
        db.session.commit()
        return record.id


class AppSafetyTests(unittest.TestCase):
    def test_rejects_non_memory_database_before_accessing_normal_path(self):
        with patch('app.get_os_db_path') as path:
            for config in [{}, {'TESTING': False, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'},
                           {'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///app.db'}]:
                with self.subTest(config=config), self.assertRaises(ValueError):
                    create_app(config)
            path.assert_not_called()


class RecordTests(DatabaseTestCase):
    def test_create_persists_fields_and_lists_activity_metadata(self):
        response = self.client.post('/api/records', json={
            'activity_id': self.activity_id, 'value': 12.5, 'memo': '本A',
            'created_at': '2026-10-13T09:30:00'})
        self.assertEqual(response.status_code, 201)
        db.session.expire_all()
        record = db.session.get(Record, response.json['id'])
        self.assertEqual((record.activity_id, record.value, record.memo), (self.activity_id, 12.5, '本A'))
        self.assertEqual(record.created_at, datetime.datetime(2026, 10, 13, 9, 30))
        response = self.client.get('/api/records')
        self.assertEqual(response.status_code, 200)
        item = response.json[0]
        self.assertEqual(item['activity_name'], '読書')
        self.assertEqual(item['unit'], 'minutes')
        self.assertEqual(item['activity_group'], '学習')
        self.assertEqual(item['tags'][0]['name'], '本')
        self.assertEqual(item['created_at'], '2026-10-13T09:30:00')

    def test_create_defaults_and_zero_value(self):
        before = datetime.datetime.utcnow()
        response = self.client.post('/api/records', json={'activity_id': self.activity_id, 'value': 0})
        self.assertEqual(response.status_code, 201)
        record = db.session.get(Record, response.json['id'])
        self.assertEqual(record.value, 0)
        self.assertIsNone(record.memo)
        self.assertGreaterEqual(record.created_at, before)
        self.assertLessEqual(record.created_at, datetime.datetime.utcnow())

    def test_missing_required_fields_do_not_save(self):
        for data in [{}, {'value': 30}, {'activity_id': self.activity_id}]:
            with self.subTest(data=data):
                self.assertEqual(self.client.post('/api/records', json=data).status_code, 400)
                self.assertEqual(Record.query.count(), 0)

    def test_empty_list(self):
        self.assertEqual(self.client.get('/api/records').json, [])

    def test_edit_memo_preserves_other_fields_and_records(self):
        record_id = self.make_record()
        other_id = self.make_record('別の記録')
        response = self.client.put(f'/api/records/{record_id}', json={'memo': '資料をまとめる'})
        self.assertEqual(response.status_code, 200)
        db.session.expire_all()
        record = db.session.get(Record, record_id)
        self.assertEqual(record.memo, '資料をまとめる')
        self.assertEqual((record.activity_id, record.value, record.created_at),
                         (self.activity_id, 30, datetime.datetime(2026, 10, 13, 9)))
        self.assertEqual(db.session.get(Record, other_id).memo, '別の記録')

    def test_edit_all_fields_and_clear_memo(self):
        record_id = self.make_record()
        activity = Activity(name='運動', group_id=Activity.query.first().group_id, unit=ActivityUnitType.COUNT)
        db.session.add(activity)
        db.session.commit()
        response = self.client.put(f'/api/records/{record_id}', json={
            'activity_id': activity.id, 'value': 2, 'created_at': '2026-10-12T08:00:00', 'memo': ''})
        self.assertEqual(response.status_code, 200)
        db.session.expire_all()
        record = db.session.get(Record, record_id)
        self.assertEqual((record.activity_id, record.value, record.memo, record.created_at),
                         (activity.id, 2, '', datetime.datetime(2026, 10, 12, 8)))

    def test_empty_edit_does_not_modify_record(self):
        record_id = self.make_record()
        self.assertEqual(self.client.put(f'/api/records/{record_id}', json={}).status_code, 400)
        db.session.expire_all()
        self.assertEqual(db.session.get(Record, record_id).memo, '資料を読む')

    def test_missing_record_edit_and_delete(self):
        record_id = self.make_record()
        self.assertEqual(self.client.put('/api/records/9999', json={'memo': '変更'}).status_code, 404)
        self.assertEqual(self.client.delete('/api/records/9999').status_code, 404)
        self.assertIsNotNone(db.session.get(Record, record_id))

    def test_delete_only_target(self):
        record_id = self.make_record()
        other_id = self.make_record('残す')
        self.assertEqual(self.client.delete(f'/api/records/{record_id}').status_code, 200)
        db.session.expire_all()
        self.assertIsNone(db.session.get(Record, record_id))
        self.assertEqual(db.session.get(Record, other_id).memo, '残す')
        self.assertIsNotNone(db.session.get(Activity, self.activity_id))

    def test_failed_writes_rollback_and_allow_next_request(self):
        record_id = self.make_record()
        operations = [
            lambda: self.client.post('/api/records', json={'activity_id': self.activity_id, 'value': 5}),
            lambda: self.client.put(f'/api/records/{record_id}', json={'memo': '変更'}),
            lambda: self.client.delete(f'/api/records/{record_id}'),
        ]
        for operation in operations:
            with self.subTest(operation=operation), patch.object(db.session, 'commit', side_effect=SQLAlchemyError('テスト用障害')):
                with self.assertLogs(self.app.logger, level='ERROR'):
                    self.assertEqual(operation().status_code, 500)
            db.session.expire_all()
            self.assertEqual(Record.query.count(), 1)
            self.assertEqual(db.session.get(Record, record_id).memo, '資料を読む')
        self.assertEqual(self.client.put(f'/api/records/{record_id}', json={'memo': '復旧'}).status_code, 200)


class DiscordRouteTests(DatabaseTestCase):
    def test_start_update_status_stop(self):
        manager = Mock()
        manager.is_connected.return_value = True
        data = {'group': '学習', 'activity_name': '読書', 'details': '本A'}
        with patch.object(discord_routes, 'get_discord_manager_for_group', return_value=manager) as lookup:
            self.assertEqual(self.client.get('/api/discord_presence/status').json, {'connected': False})
            self.assertEqual(self.client.post('/api/discord_presence/start', json=data).status_code, 200)
            lookup.assert_called_once_with('学習')
            manager.connect.assert_called_once_with()
            manager.update_presence.assert_called_once_with(state='学習', large_text='読書', details='本A',
                                                          large_image='default_image', application_name='読書')
            self.assertEqual(self.client.get('/api/discord_presence/status').json, {'connected': True})
            data.update(details='本B', asset_key='book')
            self.assertEqual(self.client.post('/api/discord_presence/update', json=data).status_code, 200)
            manager.update_presence.assert_called_with(state='学習', large_text='読書', details='本B',
                                                      large_image='book', application_name='読書')
            self.assertEqual(self.client.post('/api/discord_presence/stop', json={'group': '学習'}).status_code, 200)
            manager.close.assert_called_once_with()
            self.assertEqual(self.client.get('/api/discord_presence/status').json, {'connected': False})

    def test_failed_connection_does_not_register_session_or_block_retry(self):
        with patch.object(rpc_module, 'Presence') as presence:
            presence.return_value.connect.side_effect = RuntimeError('Discord未起動')
            with self.assertLogs(rpc_module.logger, level='ERROR'):
                response = self.client.post('/api/discord_presence/start', json={'group': '学習'})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(discord_routes.DISCORD_MANAGERS, {})
            self.assertEqual(self.client.get('/api/discord_presence/status').json, {'connected': False})
            presence.return_value.update.assert_not_called()
            presence.return_value.connect.side_effect = None
            self.assertEqual(self.client.post('/api/discord_presence/start', json={'group': '学習'}).status_code, 200)

    def test_same_session_can_refresh_but_other_session_cannot_stop_it(self):
        data = {'group': '学習', 'session_id': 'first', 'start_time': 1234567890}
        with patch.object(rpc_module, 'Presence') as presence:
            self.assertEqual(self.client.post('/api/discord_presence/start', json=data).status_code, 200)
            self.assertEqual(self.client.post('/api/discord_presence/start', json=data).status_code, 200)
            presence.return_value.connect.assert_called_once()
            self.assertEqual(rpc_module._instance.start_time, 1234567890)
            other = {**data, 'session_id': 'second'}
            self.assertEqual(self.client.post('/api/discord_presence/start', json=other).status_code, 400)
            self.assertEqual(self.client.post('/api/discord_presence/stop', json=other).status_code, 409)
            self.assertEqual(self.client.post('/api/discord_presence/update', json=other).status_code, 409)
            self.assertEqual(self.client.get('/api/discord_presence/status').json, {'connected': True})

    def test_failed_update_reports_failure_and_next_start_reconnects(self):
        data = {'group': '学習', 'session_id': 'first'}
        with patch.object(rpc_module, 'Presence') as presence:
            self.assertEqual(self.client.post('/api/discord_presence/start', json=data).status_code, 200)
            presence.return_value.update.side_effect = RuntimeError('切断')
            with self.assertLogs(level='ERROR'):
                self.assertEqual(self.client.post('/api/discord_presence/update', json=data).status_code, 500)
            self.assertEqual(self.client.get('/api/discord_presence/status').json, {'connected': False})
            presence.return_value.close.assert_called_once()
            presence.return_value.update.side_effect = None
            self.assertEqual(self.client.post('/api/discord_presence/start', json=data).status_code, 200)
            self.assertEqual(presence.return_value.connect.call_count, 2)

    def test_initial_update_failure_does_not_leave_connected_session(self):
        data = {'group': '学習', 'session_id': 'first'}
        with patch.object(rpc_module, 'Presence') as presence:
            presence.return_value.update.side_effect = RuntimeError('切断')
            with self.assertLogs(level='ERROR'):
                self.assertEqual(self.client.post('/api/discord_presence/start', json=data).status_code, 500)
            self.assertEqual(self.client.get('/api/discord_presence/status').json, {'connected': False})
            presence.return_value.update.side_effect = None
            self.assertEqual(self.client.post('/api/discord_presence/start', json=data).status_code, 200)

    def test_rejects_second_session(self):
        manager = Mock()
        manager.is_connected.return_value = True
        discord_routes.DISCORD_MANAGERS['学習'] = manager
        with patch.object(discord_routes, 'get_discord_manager_for_group') as lookup:
            self.assertEqual(self.client.post('/api/discord_presence/start', json={'group': '別'}).status_code, 400)
            lookup.assert_not_called()

    def test_missing_client_id_and_inactive_session(self):
        self.assertEqual(self.client.post('/api/discord_presence/start', json={'group': '未登録'}).status_code, 400)
        self.assertEqual(self.client.post('/api/discord_presence/update', json={'group': '学習'}).status_code, 400)
        self.assertEqual(self.client.post('/api/discord_presence/stop', json={'group': '学習'}).status_code, 400)
        self.assertEqual(self.client.post('/api/discord_presence/stop', json={}).status_code, 400)

    def test_manager_selection_reuses_client_and_handles_unconfigured_group(self):
        first = rpc_module.get_discord_manager_for_group('学習')
        self.assertIs(first, rpc_module.get_discord_manager_for_group('学習'))
        db.session.add_all([ActivityGroup(name='運動', client_id='987654321'), ActivityGroup(name='未設定')])
        db.session.commit()
        self.assertIsNone(rpc_module.get_discord_manager_for_group('未設定'))
        second = rpc_module.get_discord_manager_for_group('運動')
        self.assertIsNot(first, second)
        self.assertEqual(second.client_id, '987654321')


class DiscordManagerTests(unittest.TestCase):
    def setUp(self):
        self.presence = patch.object(rpc_module, 'Presence')
        self.factory = self.presence.start()
        self.addCleanup(self.presence.stop)
        self.rpc = self.factory.return_value
        self.manager = rpc_module.DiscordRPCManager('123456789')

    def test_connect_once_and_keep_start_time_on_updates(self):
        with patch.object(rpc_module.time, 'time', return_value=1234567890):
            self.manager.connect()
            self.manager.connect()
        self.factory.assert_called_once_with('123456789')
        self.rpc.connect.assert_called_once_with()
        self.assertTrue(self.manager.is_connected())
        self.manager.update_presence('学習', '読書', '本A', 'book')
        self.rpc.update.assert_called_once_with(state='学習', large_text='読書', details='本A',
                                               large_image='book', start=1234567890)

    def test_failed_connect_remains_disconnected_and_can_retry(self):
        self.rpc.connect.side_effect = RuntimeError('Discord未起動')
        with self.assertLogs(rpc_module.logger, level='ERROR'):
            self.manager.connect()
        self.assertFalse(self.manager.is_connected())
        self.assertIsNone(self.manager.start_time)
        self.rpc.connect.side_effect = None
        self.manager.connect()
        self.assertTrue(self.manager.is_connected())
        self.assertEqual(self.rpc.connect.call_count, 2)

    def test_application_name_payload(self):
        self.manager.connect()
        self.manager.update_presence('学習', '読書', '本A', 'book', application_name='読書')
        activity = self.rpc.update.call_args.kwargs['payload_override']['args']['activity']
        self.assertEqual(activity['name'], '読書')
        self.assertEqual(activity['status_display_type'], rpc_module.StatusDisplayType.NAME.value)
        self.assertEqual(activity['state'], '学習')
        self.assertEqual(activity['details'], '本A')
        self.assertEqual(activity['assets']['large_image'], 'book')
        self.assertEqual(activity['timestamps']['start'], int(self.manager.start_time) * 1000)

    def test_empty_details_are_omitted_from_application_payload(self):
        self.manager.connect()
        for details in ('', None, '   '):
            with self.subTest(details=details):
                self.manager.update_presence('学習', '読書', details, 'book', application_name='読書')
                activity = self.rpc.update.call_args.kwargs['payload_override']['args']['activity']
                self.assertNotIn('details', activity)
                self.assertEqual(activity['name'], '読書')
                self.assertTrue(self.manager.is_connected())
        self.manager.update_presence('学習', '読書', 'メモを追加', 'book', application_name='読書')
        self.assertEqual(self.rpc.update.call_args.kwargs['payload_override']['args']['activity']['details'], 'メモを追加')
        self.manager.update_presence('学習', '読書', '', 'book', application_name='読書')
        self.assertNotIn('details', self.rpc.update.call_args.kwargs['payload_override']['args']['activity'])

    def test_empty_details_use_none_for_standard_presence(self):
        self.manager.connect()
        self.manager.update_presence('学習', '読書', '', 'book')
        self.assertIsNone(self.rpc.update.call_args.kwargs['details'])
        self.assertTrue(self.manager.is_connected())

    def test_discord_text_boundaries_do_not_change_saved_text(self):
        self.manager.connect()
        for text in ('A', 'あ', 'あ' * 128, 'あ' * 129, 'x' * 10000):
            with self.subTest(length=len(text)):
                self.manager.update_presence('学', '読', text, 'book', application_name='読')
                activity = self.rpc.update.call_args.kwargs['payload_override']['args']['activity']
                for value in (activity['state'], activity['details'], activity['name'], activity['assets']['large_text']):
                    self.assertGreaterEqual(len(value), 2)
                    self.assertLessEqual(len(value), 128)
                self.assertEqual(activity['details'].rstrip(), text[:128])

    def test_update_without_connection_does_nothing(self):
        self.manager.update_presence('学習', '読書', '本A', 'book')
        self.factory.assert_not_called()
        self.assertFalse(self.manager.is_connected())

    def test_update_failure_disconnects_and_propagates(self):
        self.manager.connect()
        self.rpc.update.side_effect = RuntimeError('切断')
        with self.assertLogs(rpc_module.logger, level='ERROR'), self.assertRaises(RuntimeError):
            self.manager.update_presence('学習', '読書', '本A', 'book')
        self.assertFalse(self.manager.is_connected())
        self.rpc.close.assert_called_once()

    def test_close_resets_connection_even_when_clear_fails(self):
        self.manager.connect()
        self.rpc.clear.side_effect = RuntimeError('切断')
        with self.assertLogs(rpc_module.logger, level='ERROR'):
            self.manager.close()
        self.assertFalse(self.manager.is_connected())
        self.manager.close()
        self.rpc.clear.assert_called_once_with()
        self.rpc.close.assert_called_once_with()

    def test_close_and_reconnect(self):
        self.manager.connect()
        self.manager.close()
        self.assertFalse(self.manager.is_connected())
        self.manager.connect()
        self.assertEqual(self.rpc.connect.call_count, 2)


if __name__ == '__main__':
    unittest.main()


class DiscordHandshakeTests(unittest.TestCase):
    def test_unresponsive_handshake_times_out_and_next_attempt_can_succeed(self):
        import asyncio
        from unittest.mock import AsyncMock

        async def never_responds(_self):
            await asyncio.Future()

        # 実際のIPCには接続せず、応答しないDiscordを再現する。
        presence = object.__new__(rpc_module.Presence)
        with patch.object(rpc_module, 'DISCORD_HANDSHAKE_TIMEOUT', 0.01):
            with patch.object(rpc_module.BasePresence, 'handshake', never_responds):
                with self.assertRaises(TimeoutError):
                    asyncio.run(presence.handshake())
            with patch.object(rpc_module.BasePresence, 'handshake', AsyncMock(return_value='connected')):
                self.assertEqual(asyncio.run(presence.handshake()), 'connected')
