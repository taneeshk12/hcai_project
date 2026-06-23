import json
import pickle
import faiss

from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)

with open(
    "knowledge_base/knowledge_base.json",
    "r"
) as f:
    kb = json.load(f)

texts = []

for item in kb:

    text = f"""
    Category: {item['category']}
    Title: {item['title']}
    Content: {item['content']}
    """

    texts.append(text)

embeddings = model.encode(
    texts,
    convert_to_numpy=True
)

dimension = embeddings.shape[1]

index = faiss.IndexFlatL2(dimension)

index.add(embeddings)

faiss.write_index(
    index,
    "vector_store/faiss.index"
)

with open(
    "vector_store/kb_metadata.pkl",
    "wb"
) as f:

    pickle.dump(kb, f)

print("Vector DB Created")