"""
Image generation service.
Supports xAI and OpenAI (DALL-E) via OpenAI-compatible API.
"""

import os
import base64
import uuid
from pathlib import Path
from config import config


GENERATED_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "generated")


def _ensure_dir():
    Path(GENERATED_DIR).mkdir(parents=True, exist_ok=True)


def generate_image(prompt: str, provider: str | None = None) -> dict:
    """
    Generate an image from a text prompt.
    Returns dict with 'image_url' or 'image_data' (base64) and 'filename'.
    """
    prov = (provider or config.IMAGE_PROVIDER).strip().lower()

    if prov == "none" or prov == "":
        return {"error": "Image generation is not configured. Set IMAGE_PROVIDER in .env"}

    if prov == "xai":
        return _generate_xai(prompt)
    elif prov == "dalle":
        return _generate_dalle(prompt)
    elif prov == "stability-matrix":
        return _generate_stability_matrix(prompt)
    elif prov == "pollinations":
        return _generate_pollinations(prompt)
    else:
        return {"error": f"Unknown image provider: {prov}"}


def _generate_xai(prompt: str) -> dict:
    """Generate image via xAI API."""
    if not config.XAI_API_KEY:
        return {"error": "XAI_API_KEY not configured"}

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=config.XAI_API_KEY,
            base_url=config.XAI_BASE_URL,
        )
        response = client.images.generate(
            model="grok-2-image",
            prompt=prompt,
            n=1,
            response_format="b64_json",
        )

        image_data = response.data[0].b64_json
        filename = f"{uuid.uuid4().hex[:12]}.png"
        _save_image(image_data, filename)

        return {
            "image_data": image_data,
            "filename": filename,
            "image_url": f"/static/generated/{filename}",
        }
    except Exception as e:
        return {"error": str(e)}


def _generate_dalle(prompt: str) -> dict:
    """Generate image via OpenAI DALL-E API."""
    if not config.OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY not configured"}

    try:
        from openai import OpenAI

        client = OpenAI(api_key=config.OPENAI_API_KEY)
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            n=1,
            response_format="b64_json",
        )

        image_data = response.data[0].b64_json
        filename = f"{uuid.uuid4().hex[:12]}.png"
        _save_image(image_data, filename)

        return {
            "image_data": image_data,
            "filename": filename,
            "image_url": f"/static/generated/{filename}",
        }
    except Exception as e:
        return {"error": str(e)}


def _generate_stability_matrix(prompt: str) -> dict:
    """Generate image via local Stability Matrix / Automatic1111 API."""
    try:
        import requests
        
        url = f"{config.STABILITY_MATRIX_URL.rstrip('/')}/sdapi/v1/txt2img"
        payload = {
            "prompt": prompt,
            "steps": 20,
            "width": 512,
            "height": 512
        }
        
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        
        if "images" not in data or not data["images"]:
            return {"error": "No images returned by Stability Matrix API."}
            
        image_data = data["images"][0]
        filename = f"{uuid.uuid4().hex[:12]}.png"
        _save_image(image_data, filename)

        return {
            "image_data": image_data,
            "filename": filename,
            "image_url": f"/static/generated/{filename}",
        }
    except Exception as e:
        return {"error": f"Stability Matrix API error: {str(e)}. Ensure Stability Matrix is running and API is enabled."}


def _generate_pollinations(prompt: str) -> dict:
    """Generate image via Pollinations.ai (Free, no API key needed)."""
    try:
        import requests
        from urllib.parse import quote
        
        url = f"https://image.pollinations.ai/prompt/{quote(prompt)}?nologo=true"
        
        # We need a User-Agent, some free APIs block python-requests default UA
        headers = {
            "User-Agent": "NexusAI-Chatbot/1.0"
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        image_data_b64 = base64.b64encode(response.content).decode('utf-8')
        filename = f"{uuid.uuid4().hex[:12]}.png"
        _save_image(image_data_b64, filename)

        return {
            "image_data": image_data_b64,
            "filename": filename,
            "image_url": f"/static/generated/{filename}",
        }
    except Exception as e:
        return {"error": f"Pollinations API error: {str(e)}"}


def _save_image(b64_data: str, filename: str):
    """Save a base64-encoded image to the generated directory."""
    _ensure_dir()
    filepath = os.path.join(GENERATED_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(b64_data))
