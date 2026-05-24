"""
Image generation route.
"""

from flask import Blueprint, request, jsonify
from services.image_service import generate_image

images_bp = Blueprint("images", __name__)


@images_bp.route("/generate-image", methods=["POST", "OPTIONS"])
def gen_image():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "Please provide a 'prompt' field."}), 400

    prompt = data["prompt"].strip()
    if not prompt:
        return jsonify({"error": "Prompt cannot be empty."}), 400

    provider = data.get("provider", None)
    result = generate_image(prompt, provider=provider)

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)
