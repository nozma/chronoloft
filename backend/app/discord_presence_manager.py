import logging
import time

from pypresence import Presence
from pypresence.payloads import Payload
from pypresence.utils import remove_none
from pypresence.types import StatusDisplayType

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
                # 接続失敗を接続済みと誤判定せず、次回の再接続を可能にする。
                self.close(clear=False)
                logger.error("Failed to connect to Discord RPC: %s", e)

    def update_presence(self, state, large_text, details, large_image, application_name=None):
        if self.rpc:
            try:
                if application_name:
                    payload = Payload.set_activity(
                        state=state,
                        details=details,
                        start=int(self.start_time) * 1000,
                        large_image=large_image,
                        large_text=large_text,
                        instance=True,
                        activity=True
                    ).data
                    activity_payload = payload.get("args", {}).get("activity")
                    if activity_payload is not None:
                        activity_payload["name"] = application_name
                        activity_payload["status_display_type"] = StatusDisplayType.NAME.value
                        payload["args"]["activity"] = remove_none(activity_payload)
                    self.rpc.update(payload_override=payload)
                else:
                    self.rpc.update(
                        state=state,
                        large_text=large_text,
                        details=details,
                        large_image=large_image,
                        start=self.start_time,  # 接続開始時刻を利用
                    )
            except Exception as e:
                self.close(clear=False)
                logger.error("Failed to update Discord RPC: %s", e)
                raise

    def close(self, clear=True):
        rpc, self.rpc = self.rpc, None
        self.start_time = None
        if rpc is None:
            return
        try:
            if clear:
                rpc.clear()
        except Exception as e:
            logger.error("Failed to clear Discord RPC: %s", e)
        finally:
            try:
                rpc.close()
            except Exception as e:
                logger.error("Failed to close Discord RPC: %s", e)
                # 接続前の失敗などでライブラリの終了処理が中断してもループを解放する。
                if getattr(rpc, 'loop', None) is not None and not rpc.loop.is_closed():
                    rpc.loop.close()

    def is_connected(self):
        # 通信失敗時には接続を破棄し、次の開始要求で再接続する。
        return self.rpc is not None

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
