"""Add group_id to Activity

Revision ID: da0630ea5712
Revises: a15e908b4e22
Create Date: 2025-02-24 18:35:03.038893

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'da0630ea5712'
down_revision = 'a15e908b4e22'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('activity', schema=None) as batch_op:
        batch_op.add_column(sa.Column('group_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_activity_group_id_activity_group',
            'activity_group',
            ['group_id'],
            ['id']
        )


def downgrade():
    with op.batch_alter_table('activity', schema=None) as batch_op:
        batch_op.drop_constraint('fk_activity_group_id_activity_group', type_='foreignkey')
        batch_op.drop_column('group_id')