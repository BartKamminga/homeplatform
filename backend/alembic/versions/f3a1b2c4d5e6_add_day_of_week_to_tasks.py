"""add_day_of_week_to_tasks

Revision ID: f3a1b2c4d5e6
Revises: c6443825b65a
Create Date: 2026-06-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'f3a1b2c4d5e6'
down_revision = 'c6443825b65a'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tasks', sa.Column('day_of_week', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('tasks', 'day_of_week')
