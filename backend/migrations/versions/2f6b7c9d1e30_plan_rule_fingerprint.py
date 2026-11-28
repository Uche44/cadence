"""plan rule fingerprint

Revision ID: 2f6b7c9d1e30
Revises: 1a654d112868
Create Date: 2026-11-26 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f6b7c9d1e30"
down_revision: Union[str, Sequence[str], None] = "1a654d112868"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("plans", sa.Column("rules_fingerprint", sa.String(length=64), nullable=True))
    op.add_column(
        "plans",
        sa.Column("stale", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("plans", "stale")
    op.drop_column("plans", "rules_fingerprint")
