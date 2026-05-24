"""
Document management routes — listing and clearing.
"""

from flask import Blueprint, request, jsonify
from services.rag_service import get_documents, clear_documents
from routes.auth import require_auth
from flask import g

documents_bp = Blueprint("documents", __name__)


@documents_bp.route("/documents", methods=["GET", "OPTIONS"])
@require_auth
def list_documents():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    user_id = g.user["user_id"] if hasattr(g, "user") else None
    result = get_documents(user_id=user_id)
    return jsonify(result)


@documents_bp.route("/clear", methods=["POST", "OPTIONS"])
@require_auth
def clear():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    try:
        user_id = g.user["user_id"] if hasattr(g, "user") else None
        clear_documents(user_id=user_id)
        return jsonify({"message": "All documents cleared."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
