"""AI-powered document classifier for cybersecurity requirements.

This module provides document classification capabilities using LLM models
to extract cybersecurity requirements, keywords, and metadata from documents.
"""

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List

from dotenv import load_dotenv
from langchain.schema import AIMessage
from langchain.schema.runnable import RunnableSequence
from langchain_openai import ChatOpenAI

from .models import ClassificationConfig, KeywordExtractionConfig
from .prompt import custom_prompt, extract_prompt, keywords_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
logger.info("Loading environment variables from .env file")

# Determine model provider
USE_OPENROUTER = os.getenv("USE_OPENROUTER", "false").lower() == "true"
MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
API_TEMPERATURE = float(os.getenv("API_TEMPERATURE", 0.1))

# API Keys and Endpoints
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_BASE = os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")

# Maximum text size for prompts
max_document_size = int(os.getenv("MAX_DOCUMENT_SIZE", 3000))


def get_chat_model():
    """Factory to return the appropriate chat model based on configuration."""
    if USE_OPENROUTER:
        logger.info("Using OpenRouter provider for LLM")
        return ChatOpenAI(
            model_name=MODEL_NAME,
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base=OPENROUTER_API_BASE,
            temperature=API_TEMPERATURE,
        )
    logger.info("Using OpenAI provider for LLM")
    return ChatOpenAI(
        model_name=MODEL_NAME,
        openai_api_key=OPENAI_API_KEY,
        temperature=API_TEMPERATURE,
    )


# Initialize LangChain Chat model
document_chat_model = get_chat_model()


def normalize_json(raw: str) -> str:
    """
    Extract only the valid JSON part from a JSON-like string and correct duplicated braces.
    """
    try:
        # Extract only the JSON substring
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == -1:
            raise ValueError("Braces not found")
        json_candidate = raw[start:end]
        # If there are duplicate closing braces '}}' at the end, reduce to one
        json_candidate = re.sub(r"\}\s*\}\s*$", "}", json_candidate)
        return json_candidate
    except Exception as e:
        logger.error(f"JSON normalization error: {str(e)}")
        return raw  # Return as is if normalization fails


def req_list_to_str(reqs: List[str]) -> str:
    """
    Convert a list of requirements into a formatted string.
    """
    return (
        "\n".join(
            [f"{r['id']}. [{r['subject']}] [{r['type']}] {r['text']}" for r in reqs]
        )
        or ""
    )


class DocumentClassifier:
    """Medical Device Cybersecurity Document Classifier"""

    # Use class-level model attribute to ensure availability
    model = document_chat_model

    def __init__(self):
        """Initialize the classifier"""
        pass

    def classify_document(
        self, document_text: str, config: ClassificationConfig
    ) -> Dict[str, Any]:
        result = {
            "timestamp": datetime.now().isoformat(),
            "requirements": [],
            "keywords": [],
        }

        # Extract security requirements
        reqs = self._extract_document(document_text)
        # Prepare text for classification and keyword extraction
        text_for_fw = req_list_to_str(reqs) or document_text
        result["requirements"] = self._classify_custom(text_for_fw)
        # Extract keywords using the provided KeywordExtractionConfig
        result["keywords"] = self._extract_keywords(text_for_fw, config.keyword_config)

        return result

    def _classify_custom(self, document_text: str) -> List[Dict[str, Any]]:
        prompt_text = document_text[:max_document_size]

        sequence = RunnableSequence(custom_prompt, self.model)
        raw = sequence.invoke({"text": prompt_text})
        if isinstance(raw, AIMessage):
            raw = raw.content
        try:
            data = json.loads(normalize_json(raw))
            return data.get("requirements", [])
        except Exception as e:
            logger.error(f"Classify parse error: {e}")
            return {}

    def _extract_document(self, document_text: str) -> List[Dict[str, Any]]:
        prompt_text = document_text[:max_document_size]
        sequence = RunnableSequence(extract_prompt, self.model)
        raw = sequence.invoke({"text": prompt_text})
        if isinstance(raw, AIMessage):
            raw = raw.content
        try:
            data = json.loads(normalize_json(raw))
            return data.get("requirements", [])
        except Exception as e:
            logger.error(f"Extract error: {e}")
            return []

    def _extract_keywords(
        self, document_text: str, keyword_config: KeywordExtractionConfig
    ) -> List[Dict[str, Any]]:
        prompt_text = document_text[:max_document_size]
        sequence = RunnableSequence(keywords_prompt, self.model)
        raw = sequence.invoke(
            {
                "text": prompt_text,
                "min_length": keyword_config.min_keyword_length,
                "max_kws": keyword_config.max_keywords,
            }
        )
        if isinstance(raw, AIMessage):
            raw = raw.content
        try:
            data = json.loads(normalize_json(raw))
            return data.get("keywords", [])
        except Exception as e:
            logger.error(f"Keywords error: {e}")
            return []
