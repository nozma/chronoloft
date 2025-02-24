"""Make group_id not nullable

Revision ID: 9a92da123321
Revises: bc49dce5aec0
Create Date: 2025-02-24 18:41:47.446273

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9a92da123321'
down_revision = 'bc49dce5aec0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('activity', schema=None) as batch_op:
        batch_op.alter_column('group_id', existing_type=sa.Integer(), nullable=False)

def downgrade():
    with op.batch_alter_table('activity', schema=None) as batch_op:
        batch_op.alter_column('group_id', existing_type=sa.Integer(), nullable=True)