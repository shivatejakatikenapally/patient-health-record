"""Add Phase 1 patient and provider data."""
from alembic import op
import sqlalchemy as sa

revision = "0002_phase1_data"
down_revision = "0001_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "patient_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference_id", sa.String(20), nullable=False),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_patient_profiles_user_id"),
        sa.UniqueConstraint("reference_id", name="uq_patient_profiles_reference_id"),
    )
    op.create_index("ix_patient_profiles_reference_id", "patient_profiles", ["reference_id"])
    op.create_table(
        "provider_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("specialty", sa.String(120), nullable=False),
        sa.Column("facility", sa.String(160), nullable=False),
        sa.Column("registration_number", sa.String(100), nullable=True),
        sa.Column("verification_status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_provider_profiles_user_id"),
    )
    op.create_table(
        "health_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(24), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_health_records_patient_id", "health_records", ["patient_id"])
    op.create_table(
        "patient_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("record_id", sa.Uuid(), sa.ForeignKey("health_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("storage_path", name="uq_patient_documents_storage_path"),
    )
    op.create_index("ix_patient_documents_patient_id", "patient_documents", ["patient_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patient_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("resource_type", sa.String(40), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_patient_id", "audit_logs", ["patient_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # The service uses its private database connection and enforces owner filters in SQL.
    # Block direct PostgREST access until user-authenticated RLS policies are added later.
    for table in ("patient_profiles", "provider_profiles", "health_records", "patient_documents", "audit_logs"):
        op.execute(sa.text(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY'))
    op.execute(sa.text("REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated"))


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_patient_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_patient_documents_patient_id", table_name="patient_documents")
    op.drop_table("patient_documents")
    op.drop_index("ix_health_records_patient_id", table_name="health_records")
    op.drop_table("health_records")
    op.drop_table("provider_profiles")
    op.drop_index("ix_patient_profiles_reference_id", table_name="patient_profiles")
    op.drop_table("patient_profiles")
