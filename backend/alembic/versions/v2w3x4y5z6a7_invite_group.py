"""invite_tokens: group_id kolom

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'v2w3x4y5z6a7'
down_revision = 'u1v2w3x4y5z6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('invite_tokens') as batch_op:
        batch_op.add_column(sa.Column('group_id', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('invite_tokens') as batch_op:
        batch_op.drop_column('group_id')
