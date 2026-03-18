import os, sys, json, asyncio, tempfile
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
import streamlit_shim

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from database.db import (
    init_db, create_profile, get_profile, get_all_profiles,
    get_subject_summary, get_quiz_history, get_topics,
    log_quiz_attempt, get_xp, get_streak, get_level_title,
    get_xp_progress, add_xp, update_streak,
    save_learning_plan, log_error_topic, get_error_topics,
    get_ael_modality,
)
from llm.llm_engine import get_client, generate_explanation, generate_quiz_question, generate_learning_plan
from rag.rag_pipeline import build_faiss_index, retrieve_chunks, format_context, index_exists, extract_topics_from_pdf
from emotion.emotion_engine import detect_emotion, get_emotion_prompt_modifier
from xai.xai_engine import build_xai_explanation, get_xai_system_note
from kg.kg_engine import build_knowledge_graph, KnowledgeGraph

app = FastAPI(title="LLM-ITS API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup(): init_db()

class RegisterRequest(BaseModel):
    name: str; age: int; education_level: str; subjects: List[str]
    daily_hours: float; deadline: str; goals: str

class LoginRequest(BaseModel): uid: str
class ChatRequest(BaseModel):
    uid: str; subject: str; query: str; history: Optional[List[dict]] = []

class QuizGenerateRequest(BaseModel):
    uid: str; subject: str; topic: str; previous_questions: Optional[List[str]] = []
    type: Optional[str] = "mcq"

class QuizSubmitRequest(BaseModel):
    uid: str; subject: str; topic: str; question: str
    selected_index: int; correct_index: int; is_correct: bool

class PlanRequest(BaseModel): uid: str
class EmotionRequest(BaseModel): text: str
class XAIRequest(BaseModel):
    uid: str; subject: str; topic: str; query: str; accuracy: Optional[float] = 0.5

@app.get("/api/health")
def health(): return {"status": "ok"}

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    try:
        uid = create_profile(req.name, req.age, req.education_level, req.subjects, req.daily_hours, req.deadline, req.goals)
        profile = get_profile(uid)
        profile["subjects_list"] = req.subjects
        return {"uid": uid, "profile": profile}
    except Exception as e: raise HTTPException(400, str(e))

@app.post("/api/auth/login")
def login(req: LoginRequest):
    profile = get_profile(req.uid)
    if not profile: raise HTTPException(404, "Profile not found")
    profile["subjects_list"] = [s.strip() for s in profile.get("subject_list","").split(",") if s.strip()]
    return {"uid": req.uid, "profile": profile}

@app.get("/api/auth/profiles")
def list_profiles(): return get_all_profiles()

@app.get("/api/profile/{uid}")
def get_profile_ep(uid: str):
    profile = get_profile(uid)
    if not profile: raise HTTPException(404, "Not found")
    profile["subjects_list"] = [s.strip() for s in profile.get("subject_list","").split(",") if s.strip()]
    return profile

@app.get("/api/profile/{uid}/stats")
def get_stats(uid: str):
    xp = get_xp(uid); st = get_streak(uid)
    total_xp = xp.get("total_xp",0); level = xp.get("level",1)
    xp_in, xp_need = get_xp_progress(total_xp, level)
    return {"total_xp":total_xp,"level":level,"level_title":get_level_title(level),
            "xp_in_level":xp_in,"xp_needed":xp_need,
            "xp_progress_pct":round(xp_in/xp_need*100,1) if xp_need else 0,
            "current_streak":st.get("current_streak",0),"longest_streak":st.get("longest_streak",0),
            "quiz_attempts":len(get_quiz_history(uid)),"summaries":get_subject_summary(uid)}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    profile = get_profile(req.uid)
    if not profile: raise HTTPException(404, "Not found")
    profile["current_subject"] = req.subject
    chunks = retrieve_chunks(req.subject, req.query)
    context = format_context(chunks)
    emotion_result = None
    emotion_modifier = ""
    try:
        emotion_result = detect_emotion(req.query)
        emotion_modifier = get_emotion_prompt_modifier(emotion_result) if emotion_result else ""
    except Exception:
        pass
    modality_idx = get_ael_modality(req.uid, req.subject, "") or 0
    try: modality_idx = int(modality_idx)
    except: modality_idx = 0

    async def event_stream():
        emotion_data = {}
        if emotion_result:
            try:
                emotion_data = {
                    "state":        emotion_result.state,
                    "action":       emotion_result.action,
                    "xai":          emotion_result.xai_reason,
                    "scores":       emotion_result.vector.to_dict() if emotion_result.vector else {},
                    "should_reroute": emotion_result.should_reroute,
                }
            except Exception:
                pass
        yield f"data: {json.dumps({'type':'meta','emotion': emotion_data,'modality':modality_idx})}\n\n"
        try:
            full = generate_explanation(req.query, context, profile, modality_idx, history=req.history[-3:] if req.history else [], emotion_modifier=emotion_modifier)
            words = full.split(" ")
            for i, word in enumerate(words):
                yield f"data: {json.dumps({'type':'token','text':word+(' ' if i<len(words)-1 else '')})}\n\n"
                await asyncio.sleep(0.02)
            yield f"data: {json.dumps({'type':'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','message':str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/api/quiz/generate")
def quiz_generate(req: QuizGenerateRequest):
    profile = get_profile(req.uid)
    if not profile: raise HTTPException(404, "Not found")
    summaries = get_subject_summary(req.uid)
    mastery = next((s.get("strength_label","Moderate") for s in summaries if s["subject"]==req.subject), "Moderate")
    q_type = getattr(req, "type", "mcq")
    q = generate_quiz_question(req.subject, req.topic, mastery, req.previous_questions, q_type)
    if not q: raise HTTPException(500, "Failed to generate question")
    return q

@app.post("/api/quiz/submit")
def quiz_submit(req: QuizSubmitRequest):
    try:
        log_quiz_attempt(req.uid, req.subject, req.topic, score=1 if req.is_correct else 0, total=1, latency=0, ael_modality=0)
        if req.is_correct: add_xp(req.uid, 10)
        else: log_error_topic(req.uid, req.subject, req.topic)
        update_streak(req.uid)
        return {"saved": True, "xp_earned": 10 if req.is_correct else 0}
    except Exception as e: raise HTTPException(500, str(e))

@app.post("/api/plan/generate")
def plan_generate(req: PlanRequest):
    profile = get_profile(req.uid)
    if not profile: raise HTTPException(404, "Not found")
    summaries = get_subject_summary(req.uid)
    subjects_list = [s.strip() for s in (profile.get("subject_list") or "").split(",") if s.strip()]
    weak = {subj: list({r["topic"] for r in get_quiz_history(req.uid) if r["subject"]==subj and r.get("score", 0) == 0}) for subj in subjects_list}
    
    plan_text = generate_learning_plan(profile, summaries, weak)
    
    try:
        from database.db import save_learning_plan, get_latest_plan, save_plan_days
        deadline = profile.get("deadline", "End of semester")
        save_learning_plan(req.uid, plan_text, str(weak), str(summaries), deadline, 30)
        
        saved = get_latest_plan(req.uid)
        if saved and "plan_id" in saved:
            import re
            lines = [l for l in plan_text.split('\n') if l.strip()]
            days_data = []
            
            matches = list(re.finditer(r'(?:^|\n)\s*\*{0,2}(Day\s+\d+)\*{0,2}[:\-–]?\s*(.*?)(?=\n\s*\*{0,2}Day\s+\d+|$)', plan_text, flags=re.IGNORECASE|re.DOTALL))
            if matches:
                for i, m in enumerate(matches):
                    content = m.group(2).strip()
                    days_data.append({"day_number": i+1, "day_label": f"Day {i+1}", "content": content})
            else:
                size = max(3, len(lines) // 7)
                if size == 0: size = 3
                num_days = (len(lines) + size - 1) // size
                for i in range(num_days):
                    content = '\n'.join(lines[i*size : (i+1)*size])
                    days_data.append({"day_number": i+1, "day_label": f"Day {i+1}", "content": content})
            
            if days_data:
                save_plan_days(req.uid, saved["plan_id"], days_data)
    except Exception as e:
        print("Error saving plan:", e)

    return {"plan": plan_text}

@app.post("/api/syllabus/upload")
async def upload_syllabus(uid: str=Form(...), subject: str=Form(...), file: UploadFile=File(...)):
    if not file.filename.endswith(".pdf"): raise HTTPException(400, "Only PDFs accepted")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read()); tmp_path = tmp.name
    try:
        num_chunks = build_faiss_index(subject, tmp_path)
        topics = extract_topics_from_pdf(tmp_path)
        try:
            kg = build_knowledge_graph(subject, topics, get_client())
            kg_stats = kg.stats() if kg else {}
        except: kg_stats = {}
        return {"subject":subject,"chunks":num_chunks,"topics":topics,"kg_nodes":kg_stats.get("nodes",0),"kg_edges":kg_stats.get("edges",0),"index_ready":True}
    finally: os.unlink(tmp_path)

@app.get("/api/subjects/{uid}")
def get_subjects(uid: str):
    profile = get_profile(uid)
    if not profile: raise HTTPException(404, "Not found")
    subjects = [s.strip() for s in profile.get("subject_list","").split(",") if s.strip()]
    return [{"name":s,"index_ready":index_exists(s),"topics":get_topics(s)} for s in subjects]

class UpdateSubjectsRequest(BaseModel):
    uid: str
    subjects: List[str]

@app.post("/api/profile/subjects")
def update_subjects(req: UpdateSubjectsRequest):
    try:
        from database.db import update_subject_list
        update_subject_list(req.uid, req.subjects)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/xai/explain")
def xai_explain(req: XAIRequest):
    profile = get_profile(req.uid)
    if not profile: raise HTTPException(404, "Not found")
    summaries = get_subject_summary(req.uid)
    mastery = next((s.get("strength_label","Moderate") for s in summaries if s["subject"]==req.subject), "Moderate")
    emotion_result = detect_emotion(req.query)
    emotion_state = emotion_result.state if emotion_result else "neutral"
    emotion_action = emotion_result.action if emotion_result else "none"
    xai = build_xai_explanation(topic=req.topic, subject=req.subject, query=req.query, mastery_level=mastery, accuracy=req.accuracy*100, emotion_state=emotion_state, emotion_action=emotion_action)
    note = get_xai_system_note(xai)
    return {"modality_index":xai.modality_idx,"xai_explanation":note,"emotion":{"state":emotion_state,"action":emotion_action},"note":note}

@app.post("/api/emotion/detect")
def emotion_detect(req: EmotionRequest):
    result = detect_emotion(req.text)
    modifier = get_emotion_prompt_modifier(result) if result else ""
    return {"emotion":{"state":result.state,"action":result.action} if result else {},"modifier":modifier}

@app.get("/api/kg/{subject}")
def kg_get(subject: str):
    if not KnowledgeGraph.exists(subject): raise HTTPException(404, "KG not built yet")
    kg = KnowledgeGraph.load(subject)
    if not kg: raise HTTPException(404, "Failed to load KG")
    nodes = [{"id":n,"label":d.get("label",n),"difficulty":d.get("difficulty",1)} for n,d in kg.graph.nodes(data=True)]
    edges = [{"source":u,"target":v,"confidence":round(d.get("confidence",0.8),2)} for u,v,d in kg.graph.edges(data=True)]
    return {"nodes":nodes,"edges":edges,"stats":kg.stats()}

@app.get("/api/plan/{uid}")
def get_plan(uid: str):
    from database.db import get_latest_plan, get_plan_days, get_latest_plan_id
    saved = get_latest_plan(uid)
    if not saved:
        raise HTTPException(404, "No plan found")
    plan_id = saved.get("plan_id") or get_latest_plan_id(uid)
    days = get_plan_days(uid, plan_id) if plan_id else []
    return {"plan_text": saved["plan_text"], "plan_id": plan_id, "days": days}

@app.post("/api/plan/{uid}/day/{day_number}/status")
def update_day(uid: str, day_number: int, body: dict):
    from database.db import update_day_status, get_latest_plan_id
    plan_id = get_latest_plan_id(uid)
    if not plan_id:
        raise HTTPException(404, "No plan found")
    update_day_status(uid, plan_id, day_number, body.get("status", "completed"))
    if body.get("status") == "completed":
        add_xp(uid, 20)
    return {"ok": True}