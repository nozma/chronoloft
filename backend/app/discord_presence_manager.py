import atexit
from pypresence import Presence
import os
from dotenv import load_dotenv
import time
from app.models import ActivityGroup

load_dotenv()

class DiscordRPCManager:
    def __init__(self, client_id):
        self.client_id = client_id
        self.rpc = None

    def connect(self):
        if not self.rpc:
            try:
                self.rpc = Presence(self.client_id)
                self.rpc.connect()
                print("Discord RPC connected")
                # アプリ終了時に接続を切断する
                atexit.register(self.close)
            except Exception as e:
                print("Failed to connect to Discord RPC:", e)

    def update_presence(self, state, large_text, details, large_image):
        if self.rpc:
            try:
                self.rpc.update(
                    state=state,
                    large_text=large_text,
                    details=details,
                    large_image=large_image,
                    start=time.time(),
                )
            except Exception as e:
                print("Failed to update Discord RPC:", e)

    def close(self):
        if self.rpc:
            try:
                self.rpc.clear()
                print("Discord RPC disconnected")
            except Exception as e:
                print("Error while closing Discord RPC:", e)
            finally:
                self.rpc = None

def get_discord_manager_for_group(group):
    # group は例として "study", "game", "workout" などとする
    # ActivityGroup テーブルから該当するグループをクエリする
    activity_group = ActivityGroup.query.filter_by(name=group).first()
    if activity_group and activity_group.client_id:
        return DiscordRPCManager(activity_group.client_id)
    else:
        print(f"No Discord CLIENT_ID set for group {group}.")
        return None