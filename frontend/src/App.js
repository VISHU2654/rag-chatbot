import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import DocumentManager from "./components/DocumentManager";
import ImageGenerator from "./components/ImageGenerator";
import SettingsPanel from "./components/SettingsPanel";
import AuthModal from "./components/AuthModal";

const API_BASE = "http://localhost:5000";

const DEFAULT_SETTINGS = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  ragK: 4,
  hybridSearch: false,
  reranker: false,
  memoryWindow: 10,
  theme: "dark",
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ------------------------------------------------------------------ */
/*  Toast System                                                       */
/* ------------------------------------------------------------------ */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl backdrop-blur-xl border
        ${type === "success"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
          : type === "error"
          ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25"
          : "bg-surface-strong text-foreground border-border"
        }
      `}
      style={{ animation: "fadeIn 0.3s ease-out" }}
    >
      <span>{type === "success" ? "OK" : type === "error" ? "!" : "i"}</span>
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main App                                                           */
/* ------------------------------------------------------------------ */
export default function App() {
  // --- State ---
  const [activeView, setActiveView] = useState("chat");
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("nexusai_settings"));
      return { ...DEFAULT_SETTINGS, ...(stored || {}) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // --- Apply theme ---
  useEffect(() => {
    const theme = settings.theme || DEFAULT_SETTINGS.theme;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme !== "light");
    root.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [settings.theme]);

  // --- Persist settings ---
  useEffect(() => {
    localStorage.setItem("nexusai_settings", JSON.stringify(settings));
  }, [settings]);

  // --- Initial load ---
  useEffect(() => {
    const token = localStorage.getItem("nexusai_token");
    if (token) {
      fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            setUser({ ...data.user, token });
            fetchDocuments();
            fetchSessions();
          } else {
            setShowAuth(true);
          }
        })
        .catch(() => setShowAuth(true));
    } else {
      setShowAuth(true);
    }
  }, []);

  // --- Fetch Sessions ---
  const fetchSessions = useCallback(async () => {
    const token = localStorage.getItem("nexusai_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const sessionsWithMessages = await Promise.all(
            data.map(async (s) => {
              const mRes = await fetch(`${API_BASE}/sessions/${s.id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const mData = await mRes.ok ? await mRes.json() : [];
              return { ...s, messages: mData };
            })
          );
          setSessions(sessionsWithMessages);
          setActiveSession(sessionsWithMessages[0].id);
        } else {
          createNewSession();
        }
      }
    } catch {
      if (sessions.length === 0) createNewSession();
    }
  }, []);

  // --- Fetch sessions triggered only after auth, remove automatic effect ---

  // --- Helpers ---
  const addToast = useCallback((message, type = "info") => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const createNewSession = useCallback(() => {
    const id = generateId();
    const newSession = {
      id,
      name: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSession(id);
    setActiveView("chat");
  }, []);

  const fetchDocuments = async () => {
    const token = localStorage.getItem("nexusai_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {}
  };

  // --- Get current session messages ---
  const currentSession = sessions.find((s) => s.id === activeSession);
  const currentMessages = currentSession?.messages || [];

  // --- Chat handler ---
  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;

      // Add user message
      const userMsg = { role: "user", content: text };
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSession) {
            const updated = {
              ...s,
              messages: [...s.messages, userMsg],
              name: s.messages.length === 0 ? text.slice(0, 40) : s.name,
            };
            return updated;
          }
          return s;
        })
      );

      setLoading(true);

      try {
        const token = localStorage.getItem("nexusai_token");
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
          },
          body: JSON.stringify({
            message: text,
            session_id: activeSession,
            model: settings.provider,
            stream: true,
            k: settings.ragK,
            hybrid: settings.hybridSearch,
            reranker: settings.reranker,
          }),
        });

        if (res.headers.get("content-type")?.includes("text/event-stream")) {
          // Handle SSE streaming
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let botContent = "";
          let sources = [];
          let chunks = [];
          let activeTool = null;

          // Add empty bot message
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSession
                ? { ...s, messages: [...s.messages, { role: "assistant", content: "", sources: [], chunks: [], tool: null }] }
                : s
            )
          );

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.tool) {
                    if (data.status === "running") {
                      activeTool = data.tool;
                    } else if (data.status === "done") {
                      activeTool = null;
                    }
                    setSessions((prev) =>
                      prev.map((s) => {
                        if (s.id === activeSession) {
                          const msgs = [...s.messages];
                          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], tool: activeTool };
                          return { ...s, messages: msgs };
                        }
                        return s;
                      })
                    );
                  }
                  if (data.chunk) {
                    botContent += data.chunk;
                    // Update the last message
                    setSessions((prev) =>
                      prev.map((s) => {
                        if (s.id === activeSession) {
                          const msgs = [...s.messages];
                          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: botContent };
                          return { ...s, messages: msgs };
                        }
                        return s;
                      })
                    );
                  }
                  if (data.done) {
                    sources = data.sources || [];
                    chunks = data.chunks || [];
                    setSessions((prev) =>
                      prev.map((s) => {
                        if (s.id === activeSession) {
                          const msgs = [...s.messages];
                          msgs[msgs.length - 1] = {
                            ...msgs[msgs.length - 1],
                            content: botContent,
                            sources,
                            chunks,
                          };
                          return { ...s, messages: msgs };
                        }
                        return s;
                      })
                    );
                  }
                  if (data.error) {
                    addToast(data.error, "error");
                  }
                } catch {}
              }
            }
          }
        } else {
          // Non-streaming response
          const data = await res.json();
          const botMsg = {
            role: "assistant",
            content: data.reply || data.error || "No response",
            sources: data.sources || [],
            chunks: data.chunks || [],
            context_used: data.context_used,
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSession ? { ...s, messages: [...s.messages, botMsg] } : s
            )
          );
        }
      } catch {
        const errMsg = {
          role: "assistant",
          content: "Warning: Error connecting to backend. Make sure the server is running on port 5000.",
          isSystem: true,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession ? { ...s, messages: [...s.messages, errMsg] } : s
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [activeSession, loading, settings, addToast]
  );

  // --- File upload handler ---
  const uploadFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      const token = localStorage.getItem("nexusai_token");
      try {
        const res = await fetch(`${API_BASE}/ingest`, { 
          method: "POST", 
          body: formData,
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.chunks_created) {
          addToast(`Ingested ${data.files_processed} file(s) -> ${data.chunks_created} chunks`, "success");
          // Add system message to current chat
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSession
                ? {
                    ...s,
                    messages: [
                      ...s.messages,
                      {
                        role: "assistant",
                        content: `**Ingested** ${data.files_processed} file(s) -> ${data.chunks_created} chunks created.`,
                        isSystem: true,
                      },
                    ],
                  }
                : s
            )
          );
        }
        fetchDocuments();
      } catch {
        addToast("Upload failed. Is the backend running?", "error");
      } finally {
        setUploading(false);
      }
    },
    [activeSession, addToast]
  );

  // --- Auth handlers ---
  const handleAuth = (userData, token) => {
    setUser({ ...userData, token });
    setShowAuth(false);
    addToast(`Welcome, ${userData.username}!`, "success");
    // Trigger load now that we have a user
    fetchDocuments();
    fetchSessions();
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("nexusai_token");
    setSessions([]);
    setDocuments([]);
    setShowAuth(true);
    addToast("Signed out", "info");
  };

  // --- Render ---
  return (
    <div className="app-shell flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        sessions={sessions}
        activeSession={activeSession}
        onNewChat={createNewSession}
        onSelectSession={(id) => {
          setActiveSession(id);
          setActiveView("chat");
        }}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {activeView === "chat" && (
          <ChatView
            messages={currentMessages}
            onSendMessage={sendMessage}
            loading={loading}
            settings={settings}
            theme={settings.theme || DEFAULT_SETTINGS.theme}
            onThemeChange={(theme) =>
              setSettings((prev) => ({ ...prev, theme }))
            }
            onUploadFiles={uploadFiles}
            uploading={uploading}
            sessionId={activeSession}
          />
        )}
        {activeView === "documents" && (
          <DocumentManager
            documents={documents}
            onRefresh={fetchDocuments}
            onToast={addToast}
          />
        )}
        {activeView === "images" && (
          <ImageGenerator onToast={addToast} />
        )}
        {activeView === "settings" && (
          <SettingsPanel
            settings={settings}
            onSettingsChange={setSettings}
            onToast={addToast}
          />
        )}
      </main>

      {/* Auth modal */}
      {showAuth && (
        <AuthModal
          onAuth={handleAuth}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </div>
  );
}
