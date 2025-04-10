"""create suggestion table

Revision ID: 41bc48b20d5b
Revises: 
Create Date: 2025-03-10 13:23:12.930672

"""
from typing import Sequence, Union

from alembic.operations import Operations
from alembic import op as _op
import sqlalchemy as sa

# from https://github.com/sqlalchemy/alembic/issues/573#issuecomment-498672649
op = Operations(_op._proxy.migration_context, _op._proxy.impl)  # pylint:disable=W0212,E1101

# revision identifiers, used by Alembic.
revision: str = '41bc48b20d5b'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "suggestion_context",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column("original_query", sa.String(), nullable=False),
        sa.Column("language", sa.String(), nullable=False),
        sa.Column("requester", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, default=sa.func.now),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("suggestion_context")
