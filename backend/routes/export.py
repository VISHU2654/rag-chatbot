"""
Export route — export conversations as Markdown or PDF.
"""

import io
from flask import Blueprint, request, jsonify, send_file

export_bp = Blueprint("export", __name__)


@export_bp.route("/export", methods=["POST", "OPTIONS"])
def export_conversation():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"error": "Please provide a 'messages' array."}), 400

    messages = data["messages"]
    fmt = data.get("format", "markdown").lower()

    if fmt == "markdown":
        return _export_markdown(messages)
    elif fmt == "pdf":
        return _export_pdf(messages)
    else:
        return jsonify({"error": f"Unsupported format: {fmt}. Use 'markdown' or 'pdf'."}), 400


def _export_markdown(messages: list):
    """Export conversation as Markdown file."""
    lines = ["# NexusAI — Conversation Export\n\n---\n"]

    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if role == "user":
            lines.append(f"### 👤 You\n\n{content}\n\n---\n")
        else:
            lines.append(f"### 🤖 NexusAI\n\n{content}\n")
            sources = msg.get("sources", [])
            if sources:
                lines.append(f"\n_Sources: {', '.join(sources)}_\n")
            lines.append("\n---\n")

    md_content = "\n".join(lines)
    buffer = io.BytesIO(md_content.encode("utf-8"))
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype="text/markdown",
        as_attachment=True,
        download_name="nexusai_conversation.md",
    )


def _export_pdf(messages: list):
    """Export conversation as PDF file."""
    try:
        from fpdf import FPDF

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # Title
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 12, "NexusAI - Conversation Export", ln=True, align="C")
        pdf.ln(8)

        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")

            # Role header
            pdf.set_font("Helvetica", "B", 11)
            label = "You" if role == "user" else "NexusAI"
            pdf.cell(0, 8, label, ln=True)

            # Content
            pdf.set_font("Helvetica", "", 10)
            # Handle encoding — fpdf2 supports UTF-8
            try:
                pdf.multi_cell(0, 6, content)
            except Exception:
                safe_content = content.encode("latin-1", errors="replace").decode("latin-1")
                pdf.multi_cell(0, 6, safe_content)

            # Sources
            sources = msg.get("sources", [])
            if sources:
                pdf.set_font("Helvetica", "I", 8)
                pdf.cell(0, 6, f"Sources: {', '.join(sources)}", ln=True)

            pdf.ln(4)
            pdf.set_draw_color(200, 200, 200)
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(4)

        buffer = io.BytesIO(pdf.output())
        buffer.seek(0)

        return send_file(
            buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="nexusai_conversation.pdf",
        )
    except ImportError:
        return jsonify({"error": "PDF export requires fpdf2. Install with: pip install fpdf2"}), 500
