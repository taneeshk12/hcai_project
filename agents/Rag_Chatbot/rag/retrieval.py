import os
import faiss
import pickle

from sentence_transformers import SentenceTransformer

# Resolve paths relative to the project root (one level up from rag/)
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)

index = faiss.read_index(
    os.path.join(_ROOT, "vector_store", "faiss.index")
)

with open(
    os.path.join(_ROOT, "vector_store", "kb_metadata.pkl"),
    "rb"
) as f:

    kb = pickle.load(f)

def retrieve_context(query, top_k=5):

    query_embedding = model.encode(
        [query]
    )

    distances, indices = index.search(
        query_embedding,
        top_k
    )

    results = []

    for idx in indices[0]:

        results.append(kb[idx])

    return results