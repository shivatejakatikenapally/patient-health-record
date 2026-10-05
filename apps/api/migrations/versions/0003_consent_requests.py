"""Add Phase 2 consent requests and audited lifecycle."""
from alembic import op
import sqlalchemy as sa

revision = "0003_consent_requests"
down_revision = "0002_phase1_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "consents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", sa.Uuid(), sa.ForeignKey("provider_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(40), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_consents_patient_id", "consents", ["patient_id"])
    op.create_index("ix_consents_provider_id", "consents", ["provider_id"])
    op.create_index("ix_consents_status", "consents", ["status"])
    op.create_index("ix_consents_expires_at", "consents", ["expires_at"])

    # Row-Level Security: the FastAPI backend accesses via private pool and enforces owner/consent checks
    op.execute(sa.text("ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY"))


def downgrade() -> None:
    op.drop_index("ix_consents_expires_at", table_name="consents")
    op.drop_index("ix_consents_status", table_name="consents")
    op.drop_index("ix_consents_provider_id", table_name="consents")
    op.drop_index("ix_consents_patient_id", table_name="consents")
    op.drop_table("consents")
