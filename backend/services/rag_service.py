"""
Advanced RAG service with hybrid search and optional re-ranking.
"""

from config import config
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma


# Shared embeddings instance
_embeddings = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL)
    return _embeddings


def get_vector_store():
    """Get the ChromaDB vector store."""
    return Chroma(
        collection_name=config.COLLECTION_NAME,
        embedding_function=get_embeddings(),
        persist_directory=config.CHROMA_PERSIST_DIR,
    )


def add_documents(docs: list, user_id: int | None = None):
    """Add documents to the vector store."""
    vs = get_vector_store()
    if user_id is not None:
        for doc in docs:
            doc.metadata["user_id"] = user_id
    vs.add_documents(docs)


def retrieve(query: str, k: int = 4, use_hybrid: bool = False, use_reranker: bool = False, user_id: int | None = None) -> list[dict]:
    """
    Retrieve relevant documents for a query.

    Returns list of dicts with keys: content, source, score (if available).
    """
    vs = get_vector_store()
    filter_dict = {"user_id": user_id} if user_id is not None else None

    if use_hybrid:
        docs_with_scores = _hybrid_retrieve(query, vs, k, filter_dict=filter_dict)
    else:
        # Standard similarity search
        results = vs.similarity_search_with_relevance_scores(query, k=k, filter=filter_dict)
        docs_with_scores = [
            {"content": doc.page_content, "source": doc.metadata.get("source", "unknown"), "score": score}
            for doc, score in results
        ]

    if use_reranker and docs_with_scores:
        docs_with_scores = _rerank(query, docs_with_scores, k)

    return docs_with_scores


def _hybrid_retrieve(query: str, vs, k: int, filter_dict: dict | None = None) -> list[dict]:
    """Combine vector search with BM25 keyword search."""
    # Vector search
    vector_results = vs.similarity_search_with_relevance_scores(query, k=k, filter=filter_dict)
    vector_docs = [
        {"content": doc.page_content, "source": doc.metadata.get("source", "unknown"), "score": score}
        for doc, score in vector_results
    ]

    # Try BM25 keyword search
    try:
        from rank_bm25 import BM25Okapi

        # Get all docs from the collection for BM25, optionally filtering by user
        collection_data = vs.get(include=["documents", "metadatas"], where=filter_dict)
        all_docs_text = collection_data.get("documents", [])
        all_metadatas = collection_data.get("metadatas", [])

        if all_docs_text:
            tokenized = [doc.lower().split() for doc in all_docs_text]
            bm25 = BM25Okapi(tokenized)
            query_tokens = query.lower().split()
            bm25_scores = bm25.get_scores(query_tokens)

            # Get top-k BM25 results
            import numpy as np
            top_indices = np.argsort(bm25_scores)[::-1][:k]
            bm25_docs = []
            for idx in top_indices:
                if bm25_scores[idx] > 0:
                    meta = all_metadatas[idx] if idx < len(all_metadatas) else {}
                    bm25_docs.append({
                        "content": all_docs_text[idx],
                        "source": meta.get("source", "unknown") if meta else "unknown",
                        "score": float(bm25_scores[idx]),
                    })

            # Reciprocal Rank Fusion
            return _reciprocal_rank_fusion(vector_docs, bm25_docs, k)
    except ImportError:
        pass

    return vector_docs


def _reciprocal_rank_fusion(list_a: list[dict], list_b: list[dict], k: int, rrf_k: int = 60) -> list[dict]:
    """Merge two ranked lists using Reciprocal Rank Fusion."""
    scores = {}
    doc_map = {}

    for rank, doc in enumerate(list_a):
        key = doc["content"][:100]  # Use first 100 chars as key
        scores[key] = scores.get(key, 0) + 1.0 / (rrf_k + rank + 1)
        doc_map[key] = doc

    for rank, doc in enumerate(list_b):
        key = doc["content"][:100]
        scores[key] = scores.get(key, 0) + 1.0 / (rrf_k + rank + 1)
        doc_map[key] = doc

    sorted_keys = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    results = []
    for key in sorted_keys[:k]:
        doc = doc_map[key]
        doc["score"] = scores[key]
        results.append(doc)

    return results


def _rerank(query: str, docs: list[dict], k: int) -> list[dict]:
    """Re-rank documents using a cross-encoder model."""
    try:
        from sentence_transformers import CrossEncoder

        model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        pairs = [(query, doc["content"]) for doc in docs]
        scores = model.predict(pairs)

        for i, score in enumerate(scores):
            docs[i]["score"] = float(score)

        docs.sort(key=lambda x: x["score"], reverse=True)
        return docs[:k]
    except ImportError:
        return docs


def get_documents(user_id: int | None = None) -> dict:
    """List all ingested documents with metadata."""
    try:
        vs = get_vector_store()
        filter_dict = {"user_id": user_id} if user_id is not None else None
        collection_data = vs.get(include=["metadatas"], where=filter_dict)
        sources = {}
        for meta in collection_data.get("metadatas", []):
            if meta and "source" in meta:
                src = meta["source"]
                sources[src] = sources.get(src, 0) + 1

        return {
            "documents": [{"name": name, "chunks": count} for name, count in sorted(sources.items())],
            "total_chunks": len(collection_data.get("ids", [])),
        }
    except Exception as e:
        return {"documents": [], "total_chunks": 0, "error": str(e)}


def clear_documents(user_id: int | None = None):
    """Delete documents from the vector store."""
    vs = get_vector_store()
    if user_id is not None:
        # Get ids for this user and delete them
        collection_data = vs.get(where={"user_id": user_id})
        ids = collection_data.get("ids", [])
        if ids:
            vs.delete(ids=ids)
    else:
        vs.delete_collection()
