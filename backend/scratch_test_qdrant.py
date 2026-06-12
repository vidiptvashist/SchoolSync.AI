import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient

load_dotenv()

url = os.getenv("QDRANT_URL")
api_key = os.getenv("QDRANT_API_KEY")

print(f"Connecting to Qdrant URL: {url}")
client = QdrantClient(
    url=url,
    api_key=api_key,
    timeout=10,
)

try:
    cols = client.get_collections()
    print("Success! Collections:")
    print([c.name for c in cols.collections])
except Exception as e:
    print("Error connecting to Qdrant:", e)
