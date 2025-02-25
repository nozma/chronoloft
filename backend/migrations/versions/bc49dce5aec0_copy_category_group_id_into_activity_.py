"""Copy category.group_id into activity.group_id

Revision ID: bc49dce5aec0
Revises: da0630ea5712
Create Date: 2025-02-24 18:36:27.689918

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session


# revision identifiers, used by Alembic.
revision = 'bc49dce5aec0'
down_revision = 'da0630ea5712'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    session = Session(bind=bind)

    from app.models import Activity, Category

    for activity in session.query(Activity).all():
        if activity.category_id:
            category = session.query(Category).get(activity.category_id)
            if category and category.group_id:
                activity.group_id = category.group_id
    session.commit()


def downgrade():
    pass
