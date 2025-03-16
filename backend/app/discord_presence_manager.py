import atexit
import logging
from pypresence import Presence
import os
import time
from .models import ActivityGroup
from . import db

logger = logging.getLogger(__name__)
# アプリ全体で常に1つのインスタンスのみを使用するためのグローバル変数
_instance = None

class DiscordRPCManager:
    def __init__(self, client_id):
        self.client_id = client_id
        self.rpc = None
        self.start_time = None  # 接続開始時刻を管理

    def connect(self):
        if not self.rpc:
            try:
                self.rpc = Presence(self.client_id)
                self.rpc.connect()
                self.start_time = time.time()  # 接続成功時に開始時刻を記録
                print("Discord RPC connected")
            except Exception as e:
                logger.error("Failed to connect to Discord RPC: %s", e)

    def update_presence(self, state, large_text, details, large_image):
        if self.rpc:
            try:
                self.rpc.update(
                    state=state,
                    large_text=large_text,
                    details=details,
                    large_image=large_image,
                    start=self.start_time,  # 接続開始時刻を利用
                )
            except Exception as e:
                logger.error("Failed to update Discord RPC: %s", e)

    def close(self):
        if self.rpc:
            try:
                self.rpc.clear()
                logger.info("Discord RPC disconnected")
            except Exception as e:
                logger.error("Error while closing Discord RPC: %s", e)
            finally:
                self.rpc = None

def get_discord_manager_for_group(group):
    global _instance
    # 指定された group に該当する ActivityGroup を取得
    activity_group = ActivityGroup.query.filter_by(name=group).first()
    if activity_group and activity_group.client_id:
        if _instance is None or _instance.client_id != activity_group.client_id:
            _instance = DiscordRPCManager(activity_group.client_id)
        return _instance
    else:
        print(f"No Discord CLIENT_ID set for group {group}.")
        return None