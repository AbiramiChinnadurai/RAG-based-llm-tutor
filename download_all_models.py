from sentence_transformers import SentenceTransformer
import os

MODEL_NAME = "all-MiniLM-L6-v2"

def download():
    print(f"Downloading model {MODEL_NAME}...")
    SentenceTransformer(MODEL_NAME)
    print("Download complete.")

if __name__ == "__main__":
    download()
