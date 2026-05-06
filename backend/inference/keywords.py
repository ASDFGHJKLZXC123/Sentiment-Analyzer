"""YAKE keyword extraction.

YAKE returns raw scores where lower means more relevant. The frontend
inverts/normalizes these before sizing word-cloud terms.

Phase 1 corpus evaluation (`backend/explore/evaluate_corpus.py`) used
the same parameters: English, bigrams, top 5.
"""

import yake

_extractor = yake.KeywordExtractor(lan="en", n=2, top=5)


def analyze(text: str) -> list[dict]:
    """Return [{"term": str, "score": float}, ...] sorted by relevance."""
    raw = _extractor.extract_keywords(text)
    return [{"term": term, "score": round(float(score), 6)} for term, score in raw]
