"""Phase 1, Section E — model exploration scratch script.

Loads the two chosen Hugging Face models and runs YAKE on a handful of
sample inputs. Confirms:

  * sentiment model returns three labels with probabilities ~ summing to 1
  * emotion model returns seven labels with probabilities ~ summing to 1
  * YAKE returns a non-empty keyword list for plain English text
  * single-input inference latency on the local laptop

This script is intentionally NOT part of the deployable Lambda code. It
lives under backend/explore/ for reproducibility and is a candidate for
deletion once Phase 2 lands.
"""

from __future__ import annotations

import time
from pathlib import Path

from transformers import pipeline

try:
    import yake

    YAKE_AVAILABLE = True
    YAKE_ERROR: str | None = None
except Exception as exc:  # noqa: BLE001 — surface any import-time failure
    YAKE_AVAILABLE = False
    YAKE_ERROR = f"{type(exc).__name__}: {exc}"

SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"

SAMPLES = [
    "I absolutely love this product, it's amazing!",
    "This was a complete waste of money and the support team is rude.",
    "The package was delivered on Tuesday at 2 PM.",
    "Oh great, another email. Just what I needed today.",
    "lmao this is fire ngl",
]


def _fmt(scores: list[dict]) -> str:
    return ", ".join(f"{s['label']}={s['score']:.3f}" for s in scores)


def main() -> None:
    print(f"Loading sentiment model: {SENTIMENT_MODEL}")
    t0 = time.perf_counter()
    sentiment = pipeline(
        "text-classification",
        model=SENTIMENT_MODEL,
        top_k=None,
    )
    print(f"  loaded in {time.perf_counter() - t0:.2f}s")

    print(f"Loading emotion model: {EMOTION_MODEL}")
    t0 = time.perf_counter()
    emotion = pipeline(
        "text-classification",
        model=EMOTION_MODEL,
        top_k=None,
    )
    print(f"  loaded in {time.perf_counter() - t0:.2f}s")

    yake_extractor = yake.KeywordExtractor(lan="en", n=2, top=5) if YAKE_AVAILABLE else None
    if not YAKE_AVAILABLE:
        print(f"\n[!] YAKE unavailable: {YAKE_ERROR}")
        print("    Skipping keyword extraction in this run.")

    print("\n--- inference ---")
    for text in SAMPLES:
        print(f"\nINPUT: {text!r}")

        t0 = time.perf_counter()
        sent_scores = sentiment(text)[0]
        sent_dt = time.perf_counter() - t0

        t0 = time.perf_counter()
        emo_scores = emotion(text)[0]
        emo_dt = time.perf_counter() - t0

        sent_total = sum(s["score"] for s in sent_scores)
        emo_total = sum(s["score"] for s in emo_scores)

        print(f"  sentiment ({sent_dt*1000:.0f}ms, sum={sent_total:.3f}): {_fmt(sent_scores)}")
        print(f"  emotion   ({emo_dt*1000:.0f}ms, sum={emo_total:.3f}): {_fmt(emo_scores)}")

        if yake_extractor is not None:
            t0 = time.perf_counter()
            keywords = yake_extractor.extract_keywords(text)
            yake_dt = time.perf_counter() - t0
            print(f"  keywords  ({yake_dt*1000:.0f}ms): {keywords}")

    cache_dir = Path.home() / ".cache" / "huggingface"
    if cache_dir.exists():
        size_mb = sum(p.stat().st_size for p in cache_dir.rglob("*") if p.is_file()) / (1024 * 1024)
        print(f"\nHF cache size: {size_mb:.0f} MB at {cache_dir}")


if __name__ == "__main__":
    main()
