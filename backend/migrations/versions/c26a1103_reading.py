"""アクティビティの任意のよみがなを追加する。"""
from alembic import op
import sqlalchemy as sa

revision = 'c26a1103_reading'
down_revision = '8eabb803f8a4'
branch_labels = None
depends_on = None


def upgrade():
    # 起動時に列を追加済みの場合も、そのまま適用できる。
    if 'reading' not in {c['name'] for c in sa.inspect(op.get_bind()).get_columns('activity')}:
        op.add_column('activity', sa.Column('reading', sa.String(160), nullable=False, server_default=''))


def downgrade():
    with op.batch_alter_table('activity') as batch:
        batch.drop_column('reading')
