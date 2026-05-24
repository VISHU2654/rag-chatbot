"""
Memory service with persistent SQLite history.
"""

from config import config
from langchain_core.messages import HumanMessage, AIMessage
from models import get_conversation_messages, add_message

def get_session_history(session_id: str) -> list:
    """
    Retrieve conversation history from SQLite and format as LangChain messages.
    Returns only the last N messages based on MEMORY_WINDOW.
    """
    raw_messages = get_conversation_messages(session_id)
    
    # Apply sliding window (keep last N turns, where 1 turn = user + AI)
    # We multiply by 2 because window is in turns
    recent_messages = raw_messages[-(config.MEMORY_WINDOW * 2):] if raw_messages else []
    
    history = []
    for msg in recent_messages:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            history.append(AIMessage(content=msg["content"]))
            
    return history

def list_sessions(user_id: int | None = None) -> list:
    """List all available session IDs from DB."""
    from models import get_conversations
    return get_conversations(user_id)

def save_user_message(session_id: str, content: str, user_id: int | None = None):
    """Save user message to DB."""
    add_message(session_id, "user", content, user_id=user_id)

def save_assistant_message(session_id: str, content: str, sources: list = None, chunks: list = None):
    """Save assistant message to DB."""
    add_message(session_id, "assistant", content, sources=sources, chunks=chunks)
