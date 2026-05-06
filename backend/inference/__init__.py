"""Inference modules for sentiment, emotion, and keyword extraction.

Each submodule loads its model at import time (module-scope) so the
container init pays the cold-start cost once per warm window, never
per invocation.
"""
