"""実際のTCP接続で、終了直後のポート選択を確認する。"""
import errno
from pathlib import Path
import socket
import sys
import threading
import unittest
from unittest.mock import patch


with patch.object(sys, 'path', [str(Path(__file__).resolve().parents[2]), *sys.path]):
    from main import ApiBridge, find_free_port


class DesktopBrowserTests(unittest.TestCase):
    def test_browser_receives_desktop_device_id(self):
        device_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        with patch('main.webbrowser.open') as open_browser:
            ApiBridge('http://127.0.0.1:5180').open_in_browser(device_id)
        open_browser.assert_called_once_with(f'http://127.0.0.1:5180#chronoloft-device-id={device_id}')


class DesktopPortTests(unittest.TestCase):
    def listener(self, host='0.0.0.0'):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.addCleanup(server.close)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind((host, 0))
        server.listen()
        return server, server.getsockname()[1]

    @unittest.skipUnless(sys.platform != 'win32', 'POSIXのTIME_WAIT再利用を確認するテスト')
    def test_reuses_port_immediately_after_server_closes_connection(self):
        server, port = self.listener()
        with socket.create_connection(('127.0.0.1', port), timeout=2) as client:
            connection, _ = server.accept()
            with connection:
                # サーバー側から切断して、サーバーのポートにTIME_WAITを残す。
                connection.shutdown(socket.SHUT_WR)
                self.assertEqual(client.recv(1), b'')
        server.close()

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            with self.assertRaises(OSError) as error:
                probe.bind(('0.0.0.0', port))
            self.assertEqual(error.exception.errno, errno.EADDRINUSE)

        self.assertEqual(find_free_port(port), port)
        # 選んだポートが実際のサーバーでも再利用できることを確認する。
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as replacement:
            replacement.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            replacement.bind(('0.0.0.0', port))
            replacement.listen()

    def test_waits_for_previous_listener_to_finish(self):
        server, port = self.listener()
        release = threading.Timer(0.1, server.close)
        release.start()
        self.addCleanup(release.join)
        self.assertEqual(find_free_port(port), port)

    def test_uses_another_port_when_preferred_port_stays_in_use(self):
        server, port = self.listener()
        alternate = find_free_port(port)
        self.assertNotEqual(alternate, port)
        with socket.create_connection(('127.0.0.1', port), timeout=2):
            connection, _ = server.accept()
            connection.close()
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as replacement:
            replacement.bind(('0.0.0.0', alternate))
            replacement.listen()

    def test_uses_another_port_when_localhost_listener_stays_in_use(self):
        server, port = self.listener('127.0.0.1')
        self.assertNotEqual(find_free_port(port), port)
        with socket.create_connection(('127.0.0.1', port), timeout=2):
            connection, _ = server.accept()
            connection.close()


if __name__ == '__main__':
    unittest.main()
