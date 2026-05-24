"""
Authentication routes — JWT-based login and registration.
Auth is optional and controlled by AUTH_ENABLED env var.
"""

import functools
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, g

import jwt
from config import config
from models import create_user, get_user_by_username, verify_password

auth_bp = Blueprint("auth", __name__)


def require_auth(f):
    """Decorator that enforces JWT auth when AUTH_ENABLED is true."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if not config.AUTH_ENABLED:
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header."}), 401

        token = auth_header[7:]
        try:
            payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
            g.user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401

        return f(*args, **kwargs)
    return decorated


def _create_token(user: dict) -> str:
    """Create a JWT token for a user."""
    payload = {
        "user_id": user["id"],
        "username": user["username"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


@auth_bp.route("/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password required."}), 400

    username = data["username"].strip()
    password = data["password"]

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    user = create_user(username, password)
    if user is None:
        return jsonify({"error": "Username already exists."}), 409

    token = _create_token(user)
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "username": user["username"]},
    }), 201


@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password required."}), 400

    user = get_user_by_username(data["username"].strip())
    if not user or not verify_password(user["password_hash"], data["password"]):
        return jsonify({"error": "Invalid credentials."}), 401

    token = _create_token(user)
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "username": user["username"]},
    })


@auth_bp.route("/me", methods=["GET", "OPTIONS"])
@require_auth
def me():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    if hasattr(g, "user"):
        return jsonify({"user": g.user})
    return jsonify({"user": None})
