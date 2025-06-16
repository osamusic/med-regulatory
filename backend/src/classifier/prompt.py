from typing import List

from langchain.prompts import PromptTemplate

# Prompt templates for DocumentClassifier
EXTRACT_TEMPLATE = """
You are an expert in medical device cybersecurity.
The text below contains “Recommendations” and “Mandatory requirements (Obligations)” related to security measures.

Text:
{text}

Extract security requirements from this text and rewrite each requirement clearly.
Use:
- "shall" for mandatory requirements
- "should" for recommendations

For each requirement, specify:
- the type (Mandatory or Recommendation)
- the subject (Device, Manufacturer, Healthcare Provider, etc.)
- the rewritten requirement text

Respond in JSON format:
{{
  "requirements": [
    {{
      "id": 1,
      "type": "Mandatory",
      "subject": "Device",
      "text": "The device shall..."
    }},
    {{
      "id": 2,
      "type": "Recommendation",
      "subject": "Manufacturer",
      "text": "The manufacturer should..."
    }}
  ]
}}
"""

CLASSIFY_TEMPLATE = """
You are an expert in cybersecurity risk controls and technical measures.
Classify each of the cybersecurity requirements listed in the multiline string below into the single most appropriate category from the provided standardized list.

Requirements:
{text}

### Standardized Cybersecurity Control Categories:
- Identification & Access Control: User authentication, access privileges, account management.
- System Integrity: Malware protection, software verification, system security validation.
- Data Protection (Confidentiality & Integrity): Data encryption, secure storage, data leakage prevention.
- Secure Configuration Management: Hardening, secure baseline, change and configuration management.
- Network Security & Communication Control: Network segmentation, secure communications.
- Monitoring, Detection & Incident Response: Continuous monitoring, intrusion detection, logging.
- Availability & Recovery: Backup, disaster recovery, redundancy, high availability.

### Example Output:
{{
  "requirements": [
    {{
      "id": 1,
      "type": "Mandatory",
      "subject": "Device",
      "text": "The device shall..."
      "category": "Identification & Access Control"
    }},
    {{
      "id": 2,
      "type": "Recommendation",
      "subject": "Manufacturer",
      "text": "The manufacturer should..."
      "category": "Availability & Recovery"
    }}
  ]
}}

## Instructions:
- Parse each line in the provided multiline string as a separate requirement.
- Always output results in the specified JSON format.
- Assign each requirement strictly to the single most appropriate category.
- Only include requirements that clearly fit one of the categories above. Exclude all others.
"""


KEYWORDS_TEMPLATE = """
You are an expert in medical device cybersecurity.
From the text below, extract up to {max_kws} keywords related to medical device cybersecurity.
For each keyword:
  - “importance”: a FLOAT between 0.0 and 1.0 indicating its relative importance within the document
    (1.0 is most critical, 0.0 can be ignored).
  - “description”: a brief explanation of why this keyword matters in context.

Text:
{text}

Respond strictly in JSON. For example:
{{
  "keywords": [
    {{"keyword": "authentication", "importance": 0.90, "description": "Verifies user identity before accessing device functions."}},
    {{"keyword": "encryption",     "importance": 0.75, "description": "Protects data at rest and in transit against eavesdropping."}}
  ]
}}
"""

# Factory for PromptTemplate instances


def build_prompt(input_vars: List[str], template: str) -> PromptTemplate:
    """Helper to create a PromptTemplate with given variables and template text."""
    return PromptTemplate(input_variables=input_vars, template=template)


# Pre-built PromptTemplate objects
extract_prompt = build_prompt(["text"], EXTRACT_TEMPLATE)
custom_prompt = build_prompt(["text"], CLASSIFY_TEMPLATE)
keywords_prompt = build_prompt(["text", "min_length", "max_kws"], KEYWORDS_TEMPLATE)
