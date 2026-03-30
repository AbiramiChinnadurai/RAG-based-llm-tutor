import os, sys, json, asyncio, tempfile
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, str(PROJECT_ROOT))

from database.db import (
    init_db, create_profile, get_profile, get_all_profiles,
    get_subject_summary, get_quiz_history, get_topics,
    log_quiz_attempt, get_xp, get_streak, get_level_title,
    get_xp_progress, add_xp, update_streak,
    save_learning_plan, log_error_topic, get_error_topics,
    get_ael_modality, set_ael_modality, save_subject_content, get_subject_content,
    get_subjects_with_metadata, update_subject_list, save_subject_metadata,
    save_plan_days, get_plan_days, update_day_status, get_latest_plan_id,
    get_latest_plan, save_project, get_projects, update_project_status,
    create_challenge_room, get_challenge_room, submit_challenge_score, get_challenge_leaderboard
)
from llm.llm_engine import get_client, generate_explanation, generate_quiz_question, generate_learning_plan, generate_project, generate_challenge_questions
from rag.rag_pipeline import build_faiss_index, retrieve_chunks, format_context, index_exists, extract_topics_from_pdf, build_index_from_text # Added build_index_from_text
from emotion.emotion_engine import detect_emotion, get_emotion_prompt_modifier
from xai.xai_engine import build_xai_explanation, get_xai_system_note
from kg.kg_engine import build_knowledge_graph, KnowledgeGraph

app = FastAPI(title="LLM-ITS API", version="1.0.0")

# Ensure required directories exist for RAG/uploads
for d in ["uploads", "faiss_indexes", "kg_cache"]:
    os.makedirs(os.path.join(PROJECT_ROOT, d), exist_ok=True)

# In-memory tracking for background indexing
INDEXING_IN_PROGRESS = set()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://llm-tutor-frontend.vercel.app", # For production if needed
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

class ProjectGenerateRequest(BaseModel):
    uid: str; subject: str; topic: str

class ProjectStatusRequest(BaseModel):
    status: str

class AELOverrideRequest(BaseModel):
    uid: str; subject: str; topic: str; modality: int

class ChallengeCreateRequest(BaseModel):
    uid: str; subject: str; topic: str

class ChallengeSubmitRequest(BaseModel):
    uid: str; score: int; total: int

@app.get("/")
def read_root(): return {"message": "LLM-ITS Backend is LIVE", "docs": "/docs", "health": "/api/health"}

@app.get("/api/health")
def health(): return {"status": "ok"}

def ensure_index(subject: str):
    """
    Checks if the FAISS index exists locally.
    If not, pulls the full_text from Supabase and rebuilds it.
    This ensures persistence on Render free tier.
    """
    if not index_exists(subject):
        print(f"[Persistence] Index missing for {subject}. Attempting rebuild from Supabase...")
        full_text = get_subject_content(subject)
        if full_text:
            build_index_from_text(subject, full_text)
            print(f"[Persistence] Successfully rebuilt index for {subject}")
        else:
            print(f"[Persistence] No text found in Supabase for {subject}")

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

@app.get("/api/profile/{uid}/subjects")
def get_subjects(uid: str):
    try:
        raw_subjects = get_subjects_with_metadata(uid)

        # --- FALLBACK: Sync if learner_subjects is empty but profile has subjects ---
        if not raw_subjects:
            profile = get_profile(uid)
            if profile and profile.get("subject_list"):
                print(f"[Subjects Sync] Migrating legacy subjects for UID {uid}")
                subjects = [s.strip() for s in profile["subject_list"].split(",") if s.strip()]
                if subjects:
                    update_subject_list(uid, subjects)
                    raw_subjects = get_subjects_with_metadata(uid)
        # -------------------------------------------------------------------------

        # Ensure indexing status is merged in
        res = []
        for s in raw_subjects:
            s["index_ready"] = index_exists(s["subject"])
            s["indexing"] = s["subject"] in INDEXING_IN_PROGRESS
            s["name"] = s["subject"] # For frontend compatibility
            s["topics"] = get_topics(s["subject"]) # Add topics
            res.append(s)
        return res
    except Exception as e:
        raise HTTPException(500, str(e))

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
    ensure_index(req.subject)
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
            from llm.llm_engine import generate_explanation_stream
            for token in generate_explanation_stream(req.query, context, profile, modality_idx, history=req.history[-3:] if req.history else [], emotion_modifier=emotion_modifier):
                yield f"data: {json.dumps({'type':'token','text':token})}\n\n"
            yield f"data: {json.dumps({'type':'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','message':str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/api/quiz/generate")
def quiz_generate(req: QuizGenerateRequest):
    ensure_index(req.subject)
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
                # Deduplicate by day_number just in case
                unique_days = []
                seen_days = set()
                for d in days_data:
                    if d["day_number"] not in seen_days:
                        unique_days.append(d)
                        seen_days.add(d["day_number"])
                save_plan_days(req.uid, saved["plan_id"], unique_days)
    except Exception as e:
        print("Error saving plan:", e)

    return {"plan": plan_text}

def process_syllabus_task(subject: str, tmp_path: str):
    """Heavy lifting moved to background to avoid Render 30s timeout."""
    INDEXING_IN_PROGRESS.add(subject)
    try:
        print(f"[Background] Starting processing for {subject} ...")
        num_chunks, full_text = build_faiss_index(subject, tmp_path)
        print(f"[Background] Extracted {len(full_text)} chars and {num_chunks} chunks.")
        if not full_text:
            print(f"[Background] WARNING: No text extracted from {subject} PDF. RAG will not work!")
        save_subject_content(subject, full_text) # Save text to Supabase
        topics = extract_topics_from_pdf(tmp_path)
        
        save_topics(subject, topics)
        
        # KG building is the slowest part
        try:
            build_knowledge_graph(subject, topics, get_client())
        except Exception as e:
            print(f"[Background] KG Build Error: {e}")
            
        print(f"[Background] Completed processing for {subject}")
    except Exception as e:
        print(f"[Background] Processing Error: {e}")
    finally:
        INDEXING_IN_PROGRESS.discard(subject)
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.post("/api/syllabus/upload")
async def upload_syllabus(background_tasks: BackgroundTasks, uid: str=Form(...), subject: str=Form(...), file: UploadFile=File(...), deadline: str=Form(""), purpose: str=Form("")):
    if not file.filename.endswith(".pdf"): 
        raise HTTPException(400, "Only PDFs accepted")
    
    # --- FALLBACK: Add subject to profile if missing ---
    try:
        profile = get_profile(uid)
        if profile:
            raw_list = profile.get("subject_list") or ""
            current_subjects = [s.strip() for s in raw_list.split(",") if s.strip()]
            if subject not in current_subjects:
                print(f"[Upload Fallback] Adding {subject} to profile for UID {uid}")
                current_subjects.append(subject)
                update_subject_list(uid, current_subjects)
        
        # Save metadata (deadline & purpose)
        save_subject_metadata(uid, subject, deadline, purpose)
    except Exception as e:
        print(f"[Fallback] Error: {e}")
    # --------------------------------------------------

    # Save to temp file immediately
    fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, 'wb') as tmp:
            tmp.write(await file.read())
        
        # Start background processing
        background_tasks.add_task(process_syllabus_task, subject, tmp_path)
        
        return {
            "subject": subject,
            "message": "Indexing started in background. Please check back in a minute.",
            "index_ready": True # Optimistically set to True or let frontend poll
        }
    except Exception as e:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        raise HTTPException(500, str(e))

class UpdateSubjectsRequest(BaseModel):
    uid: str
    subjects: List[str]

@app.post("/api/profile/subjects")
def update_subjects(req: UpdateSubjectsRequest):
    try:
        print(f"[Subjects] Updating list for UID {req.uid}: {req.subjects}")
        update_subject_list(req.uid, req.subjects)
        return {"ok": True}
    except Exception as e:
        print(f"[Subjects] Update Error: {e}")
        raise HTTPException(500, str(e))

@app.post("/api/xai/explain")
def xai_explain(req: XAIRequest):
    ensure_index(req.subject)
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
    saved = get_latest_plan(uid)
    if not saved:
        raise HTTPException(404, "No plan found")
    plan_id = saved.get("plan_id") or get_latest_plan_id(uid)
    days = get_plan_days(uid, plan_id) if plan_id else []
    return {"plan_text": saved["plan_text"], "plan_id": plan_id, "days": days}

@app.post("/api/plan/{uid}/day/{day_number}/status")
def update_day(uid: str, day_number: int, body: dict):
    plan_id = get_latest_plan_id(uid)
    if not plan_id:
        raise HTTPException(404, "No plan found")
    update_day_status(uid, plan_id, day_number, body.get("status", "completed"))
    if body.get("status") == "completed":
        add_xp(uid, 20)
    return {"ok": True}

@app.get("/api/projects/{uid}/{subject}")
def get_user_projects(uid: str, subject: str):
    return get_projects(uid, subject)

@app.post("/api/projects/generate")
def create_user_project(req: ProjectGenerateRequest):
    print(f"DEBUG: Projects/generate request received: {req}")
    profile = get_profile(req.uid)
    if not profile:
        print(f"DEBUG: Profile NOT FOUND for uid='{req.uid}'")
        # Let's see some valid UIDs
        profiles = get_all_profiles()
        print(f"DEBUG: Total profiles in DB: {len(profiles)}. Sample UIDs: {[p['uid'] for p in profiles[:5]]}")
        raise HTTPException(404, f"Profile not found for uid={req.uid}")
    
    summaries = get_subject_summary(req.uid)
    print(f"DEBUG: Found {len(summaries)} summaries for uid={req.uid}")
    mastery = next((s.get("strength_label","Moderate") for s in summaries if s["subject"]==req.subject), "Moderate")
    
    print(f"DEBUG: Starting LLM generation for {req.topic} ({req.subject}) at {mastery}")
    p = generate_project(req.subject, req.topic, mastery)
    if not p:
        print("DEBUG: LLM generation FAILED")
        raise HTTPException(500, "Failed to generate project")
    
    project_id = save_project(req.uid, req.subject, req.topic, p["title"], p["description"], p["requirements"], p["starter_code"])
    print(f"DEBUG: Project saved with ID={project_id}")
    return {"id": project_id, **p}

@app.post("/api/projects/{project_id}/status")
def set_project_status(project_id: int, req: ProjectStatusRequest):
    update_project_status(project_id, req.status)
    return {"ok": True}

@app.post("/api/ael/override")
def ael_override(req: AELOverrideRequest):
    try:
        set_ael_modality(req.uid, req.subject, req.topic, req.modality)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/challenge/create")
def challenge_create(req: ChallengeCreateRequest):
    profile = get_profile(req.uid)
    if not profile: raise HTTPException(404, "Not found")
    summaries = get_subject_summary(req.uid)
    mastery = next((s.get("strength_label","Moderate") for s in summaries if s["subject"]==req.subject), "Moderate")
    
    questions = generate_challenge_questions(req.subject, req.topic, mastery)
    if not questions or len(questions) != 5:
        raise HTTPException(500, "Failed to generate 5 challenge questions")
        
    code = create_challenge_room(req.uid, req.subject, req.topic, questions)
    return {"room_code": code}

@app.get("/api/challenge/{room_code}")
def challenge_get(room_code: str):
    room = get_challenge_room(room_code.upper())
    if not room: raise HTTPException(404, "Room not found")
    return room

@app.post("/api/challenge/{room_code}/submit")
def challenge_submit(room_code: str, req: ChallengeSubmitRequest):
    submit_challenge_score(room_code.upper(), req.uid, req.score, req.total)
    return {"ok": True}

@app.get("/api/challenge/{room_code}/leaderboard")
def challenge_leaderboard(room_code: str):
    return get_challenge_leaderboard(room_code.upper())

@app.get("/api/profile/{uid}/heatmap/{subject}")
def get_heatmap(uid: str, subject: str):
    topics = get_topics(subject)
    history = get_quiz_history(uid, subject)
    topic_stats: dict = {}
    for attempt in history:
        t = attempt.get('topic', '')
        if not t: continue
        if t not in topic_stats:
            topic_stats[t] = {'attempts': 0, 'total_accuracy': 0.0}
        topic_stats[t]['attempts'] += 1
        topic_stats[t]['total_accuracy'] += float(attempt.get('accuracy_pct') or 0)
    result = []
    for topic in topics:
        stats = topic_stats.get(topic, {'attempts': 0, 'total_accuracy': 0.0})
        attempts = stats['attempts']
        avg_acc = round(stats['total_accuracy'] / attempts, 1) if attempts > 0 else 0.0
        if attempts == 0: label = 'Unattempted'
        elif avg_acc >= 70: label = 'Strong'
        elif avg_acc >= 40: label = 'Moderate'
        else: label = 'Weak'
        result.append({'topic': topic, 'attempts': attempts, 'avg_accuracy': avg_acc, 'strength_label': label})
    return result
