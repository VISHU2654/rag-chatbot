"""
Centralized configuration for the RAG Chatbot backend.
"""

import os
from dataclasses import dataclass, field
from enum import Enum
from dotenv import load_dotenv

load_dotenv()


class LLMProvider(str, Enum):
    GROQ = "groq"
    GROK = "grok"
    OPENAI = "openai"
    OLLAMA = "ollama"


@dataclass
class Config:
    # --- LLM ---
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq").strip().lower()

    # Groq
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Grok (xAI) — OpenAI-compatible endpoint
    XAI_API_KEY: str = os.getenv("XAI_API_KEY", "")
    GROK_MODEL: str = os.getenv("GROK_MODEL", "grok-3")
    XAI_BASE_URL: str = "https://api.x.ai/v1"

    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Ollama
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")

    # --- ChromaDB ---
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    COLLECTION_NAME: str = "rag_docs"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # --- Auth ---
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    AUTH_ENABLED: bool = os.getenv("AUTH_ENABLED", "true").strip().lower() == "true"
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

    # --- Memory ---
    MEMORY_WINDOW: int = int(os.getenv("MEMORY_WINDOW", "10"))

    # --- Image Generation ---
    IMAGE_PROVIDER: str = os.getenv("IMAGE_PROVIDER", "none").strip().lower()
    STABILITY_MATRIX_URL: str = os.getenv("STABILITY_MATRIX_URL", "http://127.0.0.1:7860")

    # --- Embedding ---
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"


config = Config()
