"""
Document ingestion route — file upload + URL ingestion.
"""

import os
import tempfile
from pathlib import Path
from flask import Blueprint, request, jsonify

from services.loader_service import load_document, load_url, split_documents, get_supported_formats
from services.rag_service import add_documents
from config import config
from routes.auth import require_auth
from flask import g

ingest_bp = Blueprint("ingest", __name__)


@ingest_bp.route("/ingest", methods=["POST", "OPTIONS"])
@require_auth
def ingest():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    if "files" not in request.files:
        return jsonify({"error": "No files provided. Use form-data with key 'files'."}), 400

    files = request.files.getlist("files")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"error": "No files selected."}), 400

    all_docs = []
    errors = []

    for file in files:
        filename = file.filename
        suffix = Path(filename).suffix.lower()

        if suffix not in get_supported_formats():
            errors.append(f"{filename}: unsupported format. Supported: {', '.join(get_supported_formats().keys())}")
            continue

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        try:
            docs = load_document(tmp_path, suffix)
            for d in docs:
                d.metadata["source"] = filename
            all_docs.extend(docs)
        except Exception as e:
            errors.append(f"{filename}: {str(e)}")
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    if not all_docs:
        return jsonify({"error": "No documents could be processed.", "details": errors}), 400

    # Split into chunks and add to vector store
    chunks = split_documents(all_docs, config.CHUNK_SIZE, config.CHUNK_OVERLAP)
    user_id = g.user["user_id"] if hasattr(g, "user") else None
    add_documents(chunks, user_id=user_id)

    return jsonify({
        "message": f"Successfully ingested {len(files) - len(errors)} file(s).",
        "files_processed": len(files) - len(errors),
        "chunks_created": len(chunks),
        "total_pages": len(all_docs),
        "errors": errors if errors else None,
    })


@ingest_bp.route("/ingest-url", methods=["POST", "OPTIONS"])
@require_auth
def ingest_url():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"error": "Please provide a 'url' field."}), 400

    url = data["url"].strip()
    depth = data.get("depth", 1)
    
    if not url.startswith("http"):
        return jsonify({"error": "Invalid URL. Must start with http or https"}), 400

    try:
        from services.loader_service import load_url, split_documents
        from config import config

        docs = load_url(url, depth=int(depth))
        for doc in docs:
            doc.metadata["source"] = url

        chunks = split_documents(docs, chunk_size=config.CHUNK_SIZE, chunk_overlap=config.CHUNK_OVERLAP)

        from services.rag_service import add_documents
        user_id = g.user["user_id"] if hasattr(g, "user") else None
        add_documents(chunks, user_id=user_id)

        return jsonify({
            "message": "URL ingested successfully",
            "chunks_created": len(chunks),
            "source": url,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ingest_bp.route("/formats", methods=["GET"])
def formats():
    return jsonify({"formats": get_supported_formats()})
