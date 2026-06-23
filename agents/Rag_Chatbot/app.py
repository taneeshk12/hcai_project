"""
RAG Chatbot — Flask Backend
Run:  python app.py
"""

import sys
import os

# Make sure imports from rag/ work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "rag"))

from flask import Flask, request, jsonify, send_from_directory
from retrieval import retrieve_context
from llm_agent import generate_report

app = Flask(__name__, static_folder="static")


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    patient_info = data.get("patient_info", "").strip()

    if not patient_info:
        return jsonify({"error": "patient_info is required"}), 400

    # 1. Retrieve relevant context from FAISS
    context_docs = retrieve_context(patient_info, top_k=5)
    context_str  = "\n\n".join(
        f"[{d['source']}] {d['title']}: {d['content']}"
        for d in context_docs
    )

    # 2. Generate clinical report via Groq LLM
    report = generate_report(patient_info, context_str)

    return jsonify({
        "report":  report,
        "sources": [
            {"title": d["title"], "source": d["source"], "category": d["category"]}
            for d in context_docs
        ],
    })


if __name__ == "__main__":
    print("=" * 50)
    print("  RAG Triage Chatbot  →  http://localhost:5001")
    print("=" * 50)
    app.run(debug=True, port=5001)
