"""
Multi-provider LLM service.
Supports Groq, Grok (xAI), OpenAI, and Ollama.
"""

import os
from config import config, LLMProvider


def get_llm(provider: str | None = None, streaming: bool = False):
    """
    Return a LangChain chat model for the requested provider.
    Falls back to the default provider from config if none specified.
    """
    prov = (provider or config.LLM_PROVIDER).strip().lower()

    if prov == LLMProvider.GROQ:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.GROQ_MODEL,
            temperature=0.2,
            streaming=streaming,
            api_key=config.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1"
        )

    elif prov == LLMProvider.GROK:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.GROK_MODEL,
            temperature=0.2,
            streaming=streaming,
            api_key=config.XAI_API_KEY,
            base_url=config.XAI_BASE_URL,
        )

    elif prov == LLMProvider.OPENAI:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.OPENAI_MODEL,
            temperature=0.2,
            streaming=streaming,
            api_key=config.OPENAI_API_KEY,
        )

    elif prov == LLMProvider.OLLAMA:
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=config.OLLAMA_MODEL,
            temperature=0.2,
            base_url=config.OLLAMA_BASE_URL,
        )

    else:
        raise ValueError(f"Unknown LLM provider: {prov}")


def list_providers() -> list[dict]:
    """Return a list of available providers with their availability status."""
    providers = []

    providers.append({
        "name": "groq",
        "available": bool(config.GROQ_API_KEY),
        "models": [config.GROQ_MODEL],
        "label": "Groq",
    })
    providers.append({
        "name": "grok",
        "available": bool(config.XAI_API_KEY),
        "models": ["grok-3", "grok-3-mini", "grok-3-fast"],
        "label": "Grok (xAI)",
    })
    providers.append({
        "name": "openai",
        "available": bool(config.OPENAI_API_KEY),
        "models": ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
        "label": "OpenAI",
    })

    # Check Ollama availability
    ollama_available = False
    try:
        import urllib.request
        req = urllib.request.Request(f"{config.OLLAMA_BASE_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=2):
            ollama_available = True
    except Exception:
        pass

    providers.append({
        "name": "ollama",
        "available": ollama_available,
        "models": [config.OLLAMA_MODEL],
        "label": "Ollama (Local)",
    })

    return providers
