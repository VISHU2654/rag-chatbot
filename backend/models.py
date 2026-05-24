"""
SQLite models for user authentication.
"""

import sqlite3
import os
from datetime import datetime

import bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")


def init_db():
    """Initialize the SQLite database and create tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            sources TEXT,
            chunks TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
    """)
    conn.commit()
    conn.close()


def create_user(username: str, password: str) -> dict | None:
    """Create a new user. Returns user dict or None if username exists."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        now = datetime.now().isoformat()
        cursor.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, password_hash, now),
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {"id": user_id, "username": username, "created_at": now}
    except sqlite3.IntegrityError:
        return None


def get_user_by_username(username: str) -> dict | None:
    """Get a user by username."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash, created_at FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "username": row[1], "password_hash": row[2], "created_at": row[3]}
    return None


def verify_password(stored_hash: str, password: str) -> bool:
    """Verify a password against its stored hash."""
    return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))


# --- Chat History Functions ---

def create_conversation(conversation_id: str, name: str, user_id: int | None = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO conversations (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
        (conversation_id, user_id, name, now)
    )
    conn.commit()
    conn.close()


def get_conversations(user_id: int | None = None) -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT id, name, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    else:
        cursor.execute("SELECT id, name, created_at FROM conversations WHERE user_id IS NULL ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "created_at": r[2]} for r in rows]


def get_conversation_messages(conversation_id: str) -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT role, content, sources, chunks, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC", (conversation_id,))
    rows = cursor.fetchall()
    conn.close()
    
    messages = []
    for r in rows:
        import json
        sources = json.loads(r[2]) if r[2] else []
        chunks = json.loads(r[3]) if r[3] else []
        messages.append({
            "role": r[0],
            "content": r[1],
            "sources": sources,
            "chunks": chunks,
            "created_at": r[4]
        })
    return messages


def add_message(conversation_id: str, role: str, content: str, sources: list = None, chunks: list = None, user_id: int | None = None):
    import json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ensure conversation exists
    cursor.execute("SELECT id FROM conversations WHERE id = ?", (conversation_id,))
    if not cursor.fetchone():
        create_conversation(conversation_id, content[:40] if content else "New Chat", user_id=user_id)
        
    now = datetime.now().isoformat()
    sources_json = json.dumps(sources) if sources else None
    chunks_json = json.dumps(chunks) if chunks else None
    
    cursor.execute(
        "INSERT INTO messages (conversation_id, role, content, sources, chunks, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (conversation_id, role, content, sources_json, chunks_json, now)
    )
    
    # Update conversation name if it's the first user message
    if role == "user":
        cursor.execute("SELECT COUNT(*) FROM messages WHERE conversation_id = ? AND role = 'user'", (conversation_id,))
        if cursor.fetchone()[0] == 1:
            cursor.execute("UPDATE conversations SET name = ? WHERE id = ?", (content[:40], conversation_id))
            
    conn.commit()
    conn.close()
