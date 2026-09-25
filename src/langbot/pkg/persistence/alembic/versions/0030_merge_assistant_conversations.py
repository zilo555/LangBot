"""Join the workspace assistant conversations branch with the released chain.

Revision ID: 0030_merge_assistant_conversations
Revises: 0029_merge_rag_identity, 0025_assistant_conversations

The assistant conversation tables ship independently of the released schema
chain. Both parents are already published, so this revision only joins the
graph; Alembic applies the missing branch before this no-op merge.
"""

revision = '0030_merge_assistant_conversations'
down_revision = ('0029_merge_rag_identity', '0025_assistant_conversations')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    # Only unmerge the revision graph; neither branch's schema/data is removed.
    pass
