# 🎓 LLM Tutor — RAG-Based Intelligent Learning Platform

An AI-powered adaptive tutoring system that delivers personalized, subject-specific learning experiences using Retrieval-Augmented Generation (RAG), large language models, and evidence-based pedagogical techniques.

---

## ✨ Features

### 🤖 Adaptive AI Tutoring (AEL)
- Real-time streaming chat with a subject-aware AI tutor
- **Adaptive Explanation Learning (AEL)** — automatically adjusts explanation style (Standard, Step-by-Step, Analogy, Worked Example, Simplified) based on student performance and emotional state
- **XAI Reasoning** — shows *why* a particular explanation mode was chosen

### 🧠 "Teach Me Back" Mode (Active Recall)
- After any AI explanation, students can type their own understanding back
- AI evaluates the self-explanation with a **score out of 10** and targeted feedback
- Promotes active recall, one of the most effective learning strategies

### 📊 Topic Difficulty Heatmap
- Visual grid of all syllabus topics color-coded by your quiz accuracy:
  - 🟢 **Strong** (≥70%) — Solid understanding
  - 🟡 **Moderate** (40–69%) — Needs revision
  - 🔴 **Weak** (<40%) — Requires focus
  - ⬜ **Unattempted** — Not yet tested
- Click any topic tile to instantly jump into studying it

### 📝 Quiz & Practice
- Auto-generated MCQ quizzes per topic with accuracy tracking
- **Written Practice** and **Coding Challenges** with AI evaluation
- Quiz history stored for long-term progress tracking

### ⚔️ Peer Challenge Rooms
- Create a 5-question quiz room with a 6-character code
- Share the code with peers to compete in real-time
- Live leaderboard with scores and rankings

### 🗺️ Study Roadmap
- Auto-generated personalized study plan based on your subjects and deadlines
- Track daily progress and completion percentage

### 📄 Syllabus Upload
- Upload your course PDF and the system automatically extracts topics
- Powers the RAG pipeline for accurate, syllabus-grounded answers

---

## 🏗️ Architecture

```
llm_tutor/
├── frontend/           # Next.js 14 (TypeScript, App Router)
├── backend/            # FastAPI server (main.py)
├── database/           # PostgreSQL persistence layer (Supabase)
├── llm/                # LLM inference via Groq API
├── rag/                # RAG pipeline (FAISS + LangChain)
├── emotion/            # Emotion detection from student text
├── kg/                 # Knowledge Graph engine
├── xai/                # Explainable AI reasoning module
└── requirements.txt    # Python dependencies
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, TypeScript, React |
| **Backend** | FastAPI, Python 3.11, Uvicorn |
| **Database** | PostgreSQL via Supabase |
| **LLM** | Groq API (LLaMA-3.1 8B Instant) |
| **RAG** | FAISS, LangChain, Sentence-Transformers |
| **Deployment** | Vercel (Frontend), Render (Backend) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project (for PostgreSQL)
- A [Groq](https://console.groq.com) API key

### 1. Clone the Repository
```bash
git clone https://github.com/AbiramiChinnadurai/RAG-based-llm-tutor.git
cd RAG-based-llm-tutor
```

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create a .env file in the backend/ directory
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
GROQ_API_KEY=your_groq_api_key_here
```

```bash
# Start the backend server
cd backend
python -m uvicorn main:app --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 📦 Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL connection string from Supabase |
| `GROQ_API_KEY` | API key from [Groq Console](https://console.groq.com) |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL of the running FastAPI backend |

---

## 🌐 Deployment

- **Frontend**: Deploy `/frontend` to [Vercel](https://vercel.com). Set `NEXT_PUBLIC_API_URL` to your Render backend URL.
- **Backend**: Deploy to [Render](https://render.com) using the `render.yaml` config in the root. Set environment variables in the Render dashboard.

---

## 📚 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create a new student profile |
| `POST` | `/api/chat` | Streaming AI tutor chat |
| `POST` | `/api/quiz/generate` | Generate a quiz question |
| `POST` | `/api/quiz/submit` | Submit and score a quiz attempt |
| `GET`  | `/api/profile/{uid}/heatmap/{subject}` | Get topic mastery heatmap |
| `POST` | `/api/syllabus/upload` | Upload a PDF syllabus |
| `POST` | `/api/challenge/create` | Create a peer challenge room |
| `GET`  | `/api/challenge/{room_code}/leaderboard` | Get challenge leaderboard |

---

## 🔬 Research Novelty

This platform integrates several research-backed techniques for educational technology:

1. **Adaptive Explanation Learning (AEL)** — Real-time modality switching based on quiz accuracy and emotion detection
2. **Teach Me Back Mode** — Implements the *Protégé Effect* (learning by teaching) through AI-evaluated self-explanation
3. **Topic Difficulty Heatmap** — Data-driven visualization of knowledge gaps using quiz performance history
4. **RAG-Grounded Responses** — All answers are grounded in the student's own uploaded syllabus, reducing hallucination

---

## 🤝 Contributing

1. Fork the repository
2. Create your branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is developed for academic research purposes.

---

*Built with ❤️ by Abirami Chinnadurai*
