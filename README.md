# NexusAI — Intelligent Document Assistant

A powerful RAG (Retrieval-Augmented Generation) chatbot with multi-model AI support, advanced hybrid search, image generation, streaming responses, and a premium dark-mode UI.

## ✨ Features

- **Multi-Model AI**: Switch between Groq, Grok (xAI), OpenAI, and Ollama
- **Advanced RAG**: Hybrid vector + keyword search, cross-encoder re-ranking
- **Expanded File Support**: PDF, TXT, DOCX, CSV, Excel, Markdown, Web URLs
- **Streaming Responses**: Real-time word-by-word AI responses via SSE
- **Conversation Memory**: Multi-turn chat with configurable context window
- **Image Generation**: Create images with xAI or DALL-E
- **Premium Dark UI**: Glassmorphism design with smooth animations
- **Export**: Download conversations as Markdown or PDF
- **Authentication**: Optional JWT-based login/register

## 🚀 Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
# Edit .env with your API keys
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000 in your browser.

## 🔧 Configuration

Edit `backend/.env` to configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | Default AI provider | `groq` |
| `GROQ_API_KEY` | Groq API key | — |
| `XAI_API_KEY` | Grok (xAI) API key | — |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `AUTH_ENABLED` | Enable login/register | `false` |
| `IMAGE_PROVIDER` | Image gen provider | `none` |
| `MEMORY_WINDOW` | Chat memory turns | `10` |

## 📦 Architecture

```
backend/
├── app.py              # Flask app factory
├── config.py           # Centralized configuration
├── models.py           # SQLite user models
├── services/           # Business logic
│   ├── llm_service.py  # Multi-provider LLM
│   ├── rag_service.py  # Advanced RAG pipeline
│   ├── loader_service.py # Document loaders
│   ├── memory_service.py # Conversation memory
│   └── image_service.py  # Image generation
└── routes/             # API endpoints
    ├── chat.py         # /chat (streaming)
    ├── ingest.py       # /ingest, /ingest-url
    ├── documents.py    # /documents, /clear
    ├── auth.py         # /login, /register
    ├── export.py       # /export
    └── images.py       # /generate-image

frontend/
├── src/
│   ├── App.js          # App shell + routing
│   └── components/
│       ├── Sidebar.js
│       ├── ChatView.js
│       ├── DocumentManager.js
│       ├── ImageGenerator.js
│       ├── SettingsPanel.js
│       ├── AuthModal.js
│       └── ExportButton.js
```
