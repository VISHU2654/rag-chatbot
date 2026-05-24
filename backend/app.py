"""
NexusAI — RAG Chatbot Backend
Flask app factory with modular blueprint architecture.
"""

import os
from pathlib import Path

from config import config
from flask import Flask, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder="static")
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------------------------------------------------------------------------
# Register Blueprints
# ---------------------------------------------------------------------------
from routes.chat import chat_bp
from routes.ingest import ingest_bp
from routes.documents import documents_bp
from routes.auth import auth_bp
from routes.export import export_bp
from routes.images import images_bp

app.register_blueprint(chat_bp)
app.register_blueprint(ingest_bp)
app.register_blueprint(documents_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(export_bp)
app.register_blueprint(images_bp)

# ---------------------------------------------------------------------------
# Routes — Health
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "message": "NexusAI backend is running.",
        "auth_enabled": config.AUTH_ENABLED,
        "default_provider": config.LLM_PROVIDER,
    })

# ---------------------------------------------------------------------------
# Routes — List available LLM providers
# ---------------------------------------------------------------------------
@app.route("/providers", methods=["GET"])
def providers():
    from services.llm_service import list_providers
    return jsonify({
        "providers": list_providers(),
        "default": config.LLM_PROVIDER,
    })

# ---------------------------------------------------------------------------
# Routes — Session management
# ---------------------------------------------------------------------------
@app.route("/sessions", methods=["GET"])
def sessions():
    from services.memory_service import list_sessions
    return jsonify({"sessions": list_sessions()})

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Ensure required directories exist
    Path(config.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
    Path("static/generated").mkdir(parents=True, exist_ok=True)

    # Initialize database
    from models import init_db
    init_db()

    print("=" * 50)
    print("  NexusAI — RAG Chatbot Backend")
    print(f"  Provider: {config.LLM_PROVIDER}")
    print(f"  Auth: {'enabled' if config.AUTH_ENABLED else 'disabled'}")
    print("=" * 50)

    app.run(host="0.0.0.0", port=5000, debug=True)