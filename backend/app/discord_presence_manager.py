import asyncio
import logging
import time

from pypresence import Presence as BasePresence
from pypresence.payloads import Payload
from pypresence.utils import remove_none
from pypresence.types import StatusDisplayType

from .models import ActivityGroup
from . import db

DISCORD_HANDSHAKE_TIMEOUT = 5


class Presence(BasePresence):
    """初回接続の応答待ちにも上限を設け、次回の再接続を可能にする。"""
    async def handshake(self):
        return await asyncio.wait_for(super().handshake(), timeout=DISCORD_HANDSHAKE_TIMEOUT)


def presence_text(value):
    # Discord表示だけを2〜128文字に整え、保存するメモや項目名は変更しない。
    if not value or not value.strip():
        return None
    return value[:128].ljust(2)


logger = logging.getLogger(__name__)
# アプリ全体で常に1つのインスタンスのみを使用するためのグローバル変数
_instance = None

class DiscordRPCManager:
    def __init__(self, client_id):
        self.client_id = client_id
        self.rpc = None
        self.last_error = None
        self.start_time = None  # 接続開始時刻を管理

    def connect(self):
        if not self.rpc:
            try:
                self.rpc = Presence(self.client_id)
                self.rpc.connect()
                self.start_time = time.time()  # 接続成功時に開始時刻を記録
                self.last_error = None
                print("Discord RPC connected")
            except Exception as e:
                # 接続失敗を接続済みと誤判定せず、次回の再接続を可能にする。
                self.close(clear=False)
                self.last_error = (f'Discordから{DISCORD_HANDSHAKE_TIMEOUT}秒以内に接続応答がありませんでした。'
                                   if isinstance(e, TimeoutError) else str(e) or type(e).__name__)
                logger.error("Failed to connect to Discord RPC: %s", e)

    def update_presence(self, state, large_text, details, large_image, application_name=None):
        if self.rpc:
            try:
                # Discordは空文字の詳細を拒否するため、未入力時は項目自体を省く。
                details = presence_text(details)
                state = presence_text(state)
                large_text = presence_text(large_text)
                application_name = presence_text(application_name)
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
