"""
llm/llm_engine.py
LLM inference via Groq API (LLaMA-3 8B) — free, fast, no local setup needed.
"""

import os
import json
import re
import streamlit as st
from groq import Groq

MODEL_NAME = "llama-3.1-8b-instant"

def get_client():
    try:
        if "supabase" in st.secrets and "GROQ_API_KEY" in st.secrets["supabase"]:
            api_key = st.secrets["supabase"]["GROQ_API_KEY"]
        else:
            api_key = st.secrets["GROQ_API_KEY"]
    except Exception:
        api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not found.")
    return Groq(api_key=api_key)


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


def generate_learning_plan(profile, subject_summaries, weak_topics_by_subject):
    """Generate a personalized learning plan."""
    prompt = build_plan_prompt(profile, subject_summaries, weak_topics_by_subject)
    try:
        return _call(prompt, temperature=0.7, max_tokens=800)
    except Exception as e:
        return f"[Error generating plan: {e}]"