"""Lightweight column migrations for dev databases (create_all does not alter)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


def _column_names(conn: Connection, table: str) -> set[str]:
    insp = inspect(conn)
    return {c["name"] for c in insp.get_columns(table)}


def migrate_conversation_message_columns(conn: Connection) -> None:
    cols = _column_names(conn, "ConversationMessage")
    additions = [
        ("reactSteps", "TEXT"),
        ("messageType", "VARCHAR"),
        ("metadata", "TEXT"),
        ("status", "VARCHAR"),
        ("stepCount", "INTEGER"),
    ]
    for name, col_type in additions:
        if name not in cols:
            conn.execute(text(f'ALTER TABLE "ConversationMessage" ADD COLUMN "{name}" {col_type}'))
