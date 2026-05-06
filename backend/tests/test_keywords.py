"""YAKE keyword extraction tests.

YAKE has no model dependency, so these run on the host fast tier
without HF cache or container setup.
"""

import sys

import pytest


def _import_keywords_fresh(monkeypatch):
    """Re-import inference.keywords to bypass conftest's mocks."""
    monkeypatch.delitem(sys.modules, "inference.keywords", raising=False)
    real_module = __import__("inference.keywords", fromlist=["analyze"])
    return real_module


def test_returns_list_of_term_score_dicts(monkeypatch):
    keywords = _import_keywords_fresh(monkeypatch)
    text = (
        "Amazing experience with the new product. The build quality is "
        "excellent and the design is beautiful."
    )
    result = keywords.analyze(text)
    assert isinstance(result, list)
    assert len(result) > 0
    for entry in result:
        assert set(entry) == {"term", "score"}
        assert isinstance(entry["term"], str)
        assert isinstance(entry["score"], float)


def test_empty_input_returns_empty_list(monkeypatch):
    keywords = _import_keywords_fresh(monkeypatch)
    assert keywords.analyze("") == []


def test_lower_score_is_more_relevant_invariant(monkeypatch):
    """YAKE returns lower=better. The Phase 1 corpus evaluation already
    confirmed this; the test pins the contract for the frontend."""
    keywords = _import_keywords_fresh(monkeypatch)
    result = keywords.analyze(
        "Amazing experience! Highly recommend to anyone looking for a great product."
    )
    if len(result) >= 2:
        assert result[0]["score"] <= result[-1]["score"]


def test_top_n_caps_at_5(monkeypatch):
    keywords = _import_keywords_fresh(monkeypatch)
    long_text = " ".join(f"word{i}" for i in range(200))
    result = keywords.analyze(long_text)
    assert len(result) <= 5
