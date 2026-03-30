"""
llm/llm_engine.py
LLM inference via Groq API (LLaMA-3 8B) — free, fast, no local setup needed.
"""

import os
import json
import re
from groq import Groq

MODEL_NAME = "llama-3.1-8b-instant"

def get_client():
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        try:
            # Manual TOML loader for local dev (secrets.toml in project root)
            import tomllib # Python 3.11+
            # Check current dir, project root, and .streamlit (legacy)
            for p in ["secrets.toml", ".streamlit/secrets.toml", "../secrets.toml"]:
                if os.path.exists(p):
                    with open(p, "rb") as f:
                        data = tomllib.load(f)
                        if "supabase" in data and "GROQ_API_KEY" in data["supabase"]:
                            api_key = data["supabase"]["GROQ_API_KEY"]
                        elif "GROQ_API_KEY" in data:
                            api_key = data["GROQ_API_KEY"]
                    if api_key: break
        except Exception:
            pass
            
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not found. Please set it as an environment variable or in a local secrets.toml file.")
    return Groq(api_key=api_key)


def _call_stream(prompt, temperature=0.7, max_tokens=300):
    """Real streaming from Groq."""
    client = get_client()
    stream = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

def _call(prompt, temperature=0.7, max_tokens=300):
    client = get_client()
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content.strip()


MODALITY_LABELS = {
    0: "Standard Prose",
    1: "Step-by-Step Decomposition",
    2: "Analogical Reasoning",
    3: "Worked Example",
    4: "Simplified Language"
}

MODALITY_INSTRUCTIONS = {
    0: "Explain clearly and concisely in 3-4 sentences.",
    1: "Break into 3 numbered steps maximum. One sentence per step.",
    2: "Use one simple real-world analogy. Map it to the concept in 2-3 sentences.",
    3: "Show one short worked example with annotations. Then one sentence summary.",
    4: "Use very simple language, short sentences, no jargon. Max 3 sentences."
}


def build_explanation_prompt(query, context, profile, modality_index, history=None, emotion_modifier=""):
    edu_level    = profile.get("education_level", "undergraduate")
    subject      = profile.get("current_subject", "the subject")
    mastery      = profile.get("mastery_level", "Moderate")
    weak_topics  = profile.get("weak_topics", [])
    modality_lbl = MODALITY_LABELS.get(modality_index, "Standard Prose")
    modality_ins = MODALITY_INSTRUCTIONS.get(modality_index, MODALITY_INSTRUCTIONS[0])
    weak_str     = ", ".join(weak_topics) if weak_topics else "None identified yet"

    emotion_block = f"{emotion_modifier}\n\n" if emotion_modifier else ""
    beginner_note = "\n- Student is NEW to this subject. Start from zero. Use the simplest possible words." if profile.get("is_beginner") else ""
    stuck_note    = "\n- Student is STUCK. Use a completely different angle or analogy. Be extra simple." if profile.get("is_stuck") else ""
    backticks     = "```"

    system_prompt = f"""{emotion_block}You are a concise intelligent tutor for a {edu_level} student studying {subject}.

STUDENT PROFILE:
- Mastery: {mastery}
- Weak Topics: {weak_str}
- Style: {modality_lbl}

STRICT RULES:
- MAXIMUM 4 sentences or 3 bullet points. Never write more.
- Use ONLY the curriculum context below. Do not add outside information.
- When the student asks for code examples, the AI must always wrap code in triple backtick markdown code blocks with the language name (e.g. {backticks}python).
- {modality_ins}{beginner_note}{stuck_note}
- Never mention you are an AI."""

    context_block = f"CURRICULUM CONTEXT:\n{context}"

    history_block = ""
    if history:
        history_block = "\nCONVERSATION HISTORY:\n"
        for turn in history[-3:]:
            history_block += f"Student: {turn['student']}\nTutor: {turn['tutor']}\n"

    return f"{system_prompt}\n\n{context_block}{history_block}\n\nSTUDENT QUESTION: {query}\n\nTUTOR RESPONSE (max 4 sentences):"


def build_quiz_prompt(subject, topic, mastery_level, difficulty, previous_questions=None, q_type="mcq"):
    prev_q_str = ""
    if previous_questions:
        prev_q_str = "\nDo NOT repeat any of these questions:\n" + "\n".join(
            [f"- {q}" for q in previous_questions[-10:]]
        )

    difficulty_map = {
        "Strong":   "advanced — requires analysis, application, or synthesis",
        "Moderate": "intermediate — tests understanding and application",
        "Weak":     "introductory — tests basic recall and comprehension"
    }
    diff_desc = difficulty_map.get(mastery_level, "intermediate")

    if q_type == "code":
        return f"""Generate exactly 1 coding problem about "{topic}" in {subject}.
Difficulty: {diff_desc}
{prev_q_str}

Return ONLY valid JSON in this exact format, nothing else:
{{
  "question": "The problem description and requirements here",
  "options": [],
  "correct_index": 0,
  "explanation": "A sample solution code"
}}"""
    elif q_type == "written":
        return f"""Generate exactly 1 open-ended conceptual question about "{topic}" in {subject}.
Difficulty: {diff_desc}
{prev_q_str}

Return ONLY valid JSON in this exact format, nothing else:
{{
  "question": "The question text here",
  "options": [],
  "correct_index": 0,
  "explanation": "A sample correct answer or key points"
}}"""

    return f"""Generate exactly 1 multiple choice question about "{topic}" in {subject}.
Difficulty: {diff_desc}
{prev_q_str}

Return ONLY valid JSON in this exact format, nothing else:
{{
  "question": "The question text here?",
  "options": ["A) option one", "B) option two", "C) option three", "D) option four"],
  "correct_index": 0,
  "explanation": "Brief explanation of why the correct answer is right."
}}

correct_index must be 0, 1, 2, or 3 (index of the correct option in the options array)."""


def build_plan_prompt(profile, subject_summaries, weak_topics_by_subject):
    name        = profile.get("name", "Student")
    deadline    = profile.get("deadline", "end of semester")
    daily_hours = profile.get("daily_hours", 2)
    goals       = profile.get("learning_goals", "Master all subjects")

    summary_lines = []
    for s in subject_summaries:
        wt     = weak_topics_by_subject.get(s["subject"], [])
        wt_str = ", ".join(wt) if wt else "None"
        summary_lines.append(
            f"  - {s['subject']}: {s['strength_label']} ({s['avg_accuracy']:.1f}% accuracy) | Weak topics: {wt_str}"
        )

    return f"""Create a detailed personalized day-by-day study plan for {name}.

STUDENT STATUS:
{chr(10).join(summary_lines)}

CONSTRAINTS:
- Daily available study hours: {daily_hours} hours
- Target deadline: {deadline}
- Learning goals: {goals}

RULES:
- Prioritize Weak subjects in the first half of the plan
- Alternate Moderate subjects for variety
- Reserve the last days for Strong subject challenge exercises and full revision
- Specify exact topics and activities for each day
- Be realistic with the time allocation

Generate a clear, structured day-by-day study schedule."""


# ── LLM CALLS ─────────────────────────────────────────────────────────────────

def generate_explanation_stream(query, context, profile, modality_index, history=None, emotion_modifier=""):
    """Stream a personalized explanation."""
    prompt = build_explanation_prompt(query, context, profile, modality_index, history, emotion_modifier)
    return _call_stream(prompt, temperature=0.7, max_tokens=300)

def generate_explanation(query, context, profile, modality_index, history=None, emotion_modifier=""):
    """Generate a personalized explanation using Groq. Emotion-aware when modifier is provided."""
    prompt = build_explanation_prompt(query, context, profile, modality_index, history, emotion_modifier)
    try:
        return _call(prompt, temperature=0.7, max_tokens=300)
    except Exception as e:
        return f"[Error generating explanation: {e}]"


def generate_quiz_question(subject, topic, mastery_level, previous_questions=None, q_type="mcq"):
    """Generate one question (MCQ, code, or written) and parse the JSON response."""
    prompt = build_quiz_prompt(subject, topic, mastery_level, mastery_level, previous_questions, q_type)
    try:
        raw = _call(prompt, temperature=0.3, max_tokens=300)
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            if all(k in data for k in ["question", "options", "correct_index", "explanation"]):
                return data
        return None
    except Exception as e:
        print(f"[LLM] Quiz generation error: {e}")
        return None

def generate_challenge_questions(subject, topic, mastery_level):
    """Generate exactly 5 multiple choice questions for a peer challenge room."""
    prompt = f"""Generate exactly 5 multiple choice questions about "{topic}" in {subject}.
Difficulty: intermediate

Return ONLY a valid JSON array of objects in this exact format, nothing else:
[
  {{
    "question": "The question text here?",
    "options": ["A) option one", "B) option two", "C) option three", "D) option four"],
    "correct_index": 0,
    "explanation": "Brief explanation."
  }}
]"""
    try:
        raw = _call(prompt, temperature=0.3, max_tokens=1500)
        json_match = re.search(r'\[.*\]', raw, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group())
                return data
            except Exception as j:
                print(f"DEBUG: JSON Parse error: {j}")
                return None
        return None
    except Exception as e:
        print(f"[LLM] Challenge generation error: {e}")
        return None


def generate_learning_plan(profile, subject_summaries, weak_topics_by_subject):
    """Generate a personalized learning plan."""
    prompt = build_plan_prompt(profile, subject_summaries, weak_topics_by_subject)
    try:
        return _call(prompt, temperature=0.7, max_tokens=800)
    except Exception as e:
        return f"[Error generating plan: {e}]"

def generate_project(subject, topic, mastery_level):
    """
    Suggest a hands-on coding project for a coding subject.
    Returns JSON with title, description, requirements (list), and starter_code.
    """
    prompt = f"""You are an expert coding tutor. Generate a small hands-on coding project for a student studying {topic} in {subject}.
Mastery Level: {mastery_level}

Requirements:
- Must be relevant to {topic}.
- Should be achievable in 1-2 hours.
- Provide 3-5 clear functional requirements.
- Provide a short and clean starter code template.

CRITICAL: Return ONLY a valid JSON object. Do not include any text before or after the JSON. Use double quotes for all keys and string values. Escape all newlines in starter_code and description as \\n.

Example format:
{{
  "title": "Project Title",
  "description": "Brief project overview",
  "requirements": ["Requirement 1", "Requirement 2", "..."],
  "starter_code": "Code block here"
}}"""
    try:
        raw = _call(prompt, temperature=0.2, max_tokens=1000)
        print(f"DEBUG: RAW LLM Project Response: {raw}")
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(), strict=False)
            except Exception as j:
                print(f"DEBUG: JSON Parse error: {j}")
                return None
        return None
    except Exception as e:
        print(f"[LLM] Project generation error: {e}")
        return None