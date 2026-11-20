import re
from typing import List, Dict, Any
import fitz  # PyMuPDF


def clean_text(text: str) -> str:
    # Collapse excessive newlines and spaces while keeping paragraph structure readable
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def split_text_with_overlap(text: str, chunk_size: int = 800, chunk_overlap: int = 150) -> List[str]:
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + chunk_size, text_len)

        # Try not to cut mid-word if we aren't at the end of the text
        if end < text_len:
            last_space = text.rfind(" ", start, end)
            if last_space > start + (chunk_size // 2):
                end = last_space

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= text_len:
            break

        start = end - chunk_overlap

    return chunks


def extract_and_chunk_pdf(file_bytes: bytes, chunk_size: int = 800, chunk_overlap: int = 150) -> Dict[str, Any]:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page_count = len(doc)
    all_chunks = []
    global_chunk_index = 0

    for page_idx in range(page_count):
        page = doc[page_idx]
        raw_text = page.get_text("text")
        cleaned = clean_text(raw_text)

        if not cleaned:
            continue

        page_chunks = split_text_with_overlap(
            cleaned, chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )

        for chunk_text in page_chunks:
            all_chunks.append(
                {
                    "page_number": page_idx + 1,
                    "chunk_index": global_chunk_index,
                    "content": chunk_text,
                }
            )
            global_chunk_index += 1

    doc.close()
    return {
        "page_count": page_count,
        "chunks": all_chunks,
    }