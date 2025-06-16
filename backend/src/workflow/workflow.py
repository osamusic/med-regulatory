"""Workflow generation and processing module."""

import os
import re
from typing import Dict, List

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

workflow_prompt = """
You are a cybersecurity process designer for medical devices.

Given the following list of requirements for the "{phase}" phase, do the following:
1. For each requirement, group them by responsible role (e.g., Development Engineer, QA, Regulatory Affairs, etc.) and write a 5-step concise work instruction for each.
2. Then, based on all requirements and roles, summarize the overall workflow for this phase as a sequence of steps (as a simple flowchart), showing the order and handoff between roles.

# Requirements List (role: requirement)
{requirements_per_role}

## Output Format
### WORKFLOW SUMMARY:
[Provide a clear workflow summary describing the sequence of activities, role handoffs, and dependencies]

### WORK INSTRUCTIONS:
For each role, provide work instructions in this format:
**Role: [Role Name]**
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]
5. [Step 5]
Input: [Input deliverables]
Output: [Output deliverables]

Repeat for each role involved.
**Ensure that each line and each section is separated by a newline.**
"""


def call_llm(prompt: str) -> str:
    """Call LLM using OpenAI client."""
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise Exception(f"LLM call failed: {str(e)}")


def extract_summary(workflow_result: str) -> str:
    """Extract the workflow summary from LLM response."""
    lines = workflow_result.split("\n")
    summary_lines = []
    in_summary = False

    for line in lines:
        if "### WORKFLOW SUMMARY:" in line or "WORKFLOW SUMMARY:" in line:
            in_summary = True
            continue
        elif line.startswith("### ") and in_summary:
            break
        elif in_summary and line.strip():
            summary_lines.append(line.strip())

    return "\n".join(summary_lines).strip()


def extract_instructions(workflow_result: str) -> Dict[str, List[str]]:
    """Extract work instructions by role from LLM response."""
    instructions = {}
    lines = workflow_result.split("\n")
    current_role = None
    current_steps = []
    in_instructions = False

    for line in lines:
        if "### WORK INSTRUCTIONS:" in line or "WORK INSTRUCTIONS:" in line:
            in_instructions = True
            continue
        elif not in_instructions:
            continue

        # Check for role header
        role_match = re.match(r"\*\*Role:\s*(.+?)\*\*", line)
        if role_match:
            # Save previous role if exists
            if current_role and current_steps:
                instructions[current_role] = current_steps
            current_role = role_match.group(1).strip()
            current_steps = []
            continue

        # Check for numbered steps
        step_match = re.match(r"\d+\.\s*(.+)", line)
        if step_match and current_role:
            current_steps.append(step_match.group(1).strip())
            continue

        # Handle Input/Output lines (skip for now, will be extracted separately)
        if line.startswith("Input:") or line.startswith("Output:"):
            continue

    # Save the last role
    if current_role and current_steps:
        instructions[current_role] = current_steps

    return instructions


def extract_inputs_outputs(
    workflow_result: str,
) -> tuple[Dict[str, str], Dict[str, str]]:
    """Extract input and output information by role from LLM response."""
    inputs = {}
    outputs = {}
    lines = workflow_result.split("\n")
    current_role = None
    in_instructions = False

    for line in lines:
        if "### WORK INSTRUCTIONS:" in line or "WORK INSTRUCTIONS:" in line:
            in_instructions = True
            continue
        elif not in_instructions:
            continue

        # Check for role header
        role_match = re.match(r"\*\*Role:\s*(.+?)\*\*", line)
        if role_match:
            current_role = role_match.group(1).strip()
            continue

        # Extract Input lines
        input_match = re.match(r"Input:\s*(.+)", line)
        if input_match and current_role:
            inputs[current_role] = input_match.group(1).strip()
            continue

        # Extract Output lines
        output_match = re.match(r"Output:\s*(.+)", line)
        if output_match and current_role:
            outputs[current_role] = output_match.group(1).strip()
            continue

    return inputs, outputs
