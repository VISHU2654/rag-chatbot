import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Paperclip,
  Loader2,
  MessageSquare,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Mic,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import ExportButton from "./ExportButton";
import ThemeSwitcher from "./ThemeSwitcher";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:5000";

/* ------------------------------------------------------------------ */
/*  Simple Markdown Renderer (no library)                             */
/* ------------------------------------------------------------------ */
function renderMarkdown(text) {
  if (!text) return null;

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1], content: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts.map((part, idx) => {
    if (part.type === "code") {
      return <CodeBlock key={idx} code={part.content} lang={part.lang} />;
    }
    return <InlineMarkdown key={idx} text={part.content} />;
  });
}

function InlineMarkdown({ text }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // Headings
        if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-semibold mt-3 mb-1">{processInline(line.slice(4))}</h4>;
        if (line.startsWith("## ")) return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{processInline(line.slice(3))}</h3>;
        if (line.startsWith("# ")) return <h2 key={i} className="text-lg font-bold mt-3 mb-1">{processInline(line.slice(2))}</h2>;
        // Bullet lists
        if (line.match(/^[\s]*[-*]\s/)) {
          const indent = line.search(/[-*]/);
          return (
            <div key={i} className="flex gap-2" style={{ paddingLeft: indent * 8 }}>
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              <span>{processInline(line.replace(/^[\s]*[-*]\s/, ""))}</span>
            </div>
          );
        }
        // Numbered lists
        if (line.match(/^\d+\.\s/)) {
          const num = line.match(/^(\d+)\./)[1];
          return (
            <div key={i} className="flex gap-2">
              <span className="text-primary/70 font-medium text-xs min-w-[1.2rem]">{num}.</span>
              <span>{processInline(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        }
        // Empty lines
        if (!line.trim()) return <div key={i} className="h-2" />;
        // Normal paragraph
        return <p key={i}>{processInline(line)}</p>;
      })}
    </div>
  );
}

function processInline(text) {
  // Bold, italic, inline code
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIdx = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    if (m[2]) parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index} className="italic opacity-90">{m[3]}</em>);
    else if (m[4]) parts.push(<code key={m.index} className="px-1.5 py-0.5 rounded bg-surface-muted text-primary text-[13px] font-mono">{m[4]}</code>);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : text;
}

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="code-block my-3 relative group">
      {lang && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/70 text-[10px] font-mono text-muted-foreground uppercase">
          {lang}
          <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-muted-foreground hover:text-foreground">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      )}
      {!lang && (
        <button onClick={handleCopy} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-hover">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      )}
      <pre className="px-4 py-3 overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatView Component                                                */
/* ------------------------------------------------------------------ */
export default function ChatView({
  messages,
  onSendMessage,
  loading,
  settings,
  theme,
  onThemeChange,
  onUploadFiles,
  uploading,
  sessionId,
}) {
  const [input, setInput] = useState("");
  const [expandedChunks, setExpandedChunks] = useState({});
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChunks = (idx) => {
    setExpandedChunks((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleMicClick = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Voice input not supported in this browser. Try Chrome.");
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => prev + (prev ? " " : "") + transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
    }
  };

  const handleSpeak = (text, idx) => {
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const plainText = text.replace(/[*_#`]/g, ""); // strip simple markdown for TTS
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.onend = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 border-b border-border/70 py-3 pl-20 pr-6 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface-muted px-3 py-1.5 text-xs">
            <Zap className="w-3 h-3 text-primary" />
            <span className="font-medium text-foreground/80">
              {settings.provider || "groq"}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{settings.model || "llama-3.3-70b"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher value={theme} onChange={onThemeChange} />
          <ExportButton messages={messages} />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fadeIn">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/70 bg-gradient-to-br from-primary/10 to-accent/10">
              <MessageSquare className="w-9 h-9 text-primary/40" />
            </div>
            <h2 className="text-lg font-semibold mb-2 gradient-text">Start a conversation</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Upload documents and ask questions. NexusAI will find the most relevant information and give you accurate answers.
            </p>
          </div>
        )}

        <div className="space-y-5 max-w-3xl mx-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 animate-fadeIn",
                msg.role === "user" ? "flex-row-reverse" : "",
                msg.isSystem ? "justify-center" : ""
              )}
            >
              {/* Avatar */}
              {!msg.isSystem && (
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1",
                    msg.role === "user"
                      ? "bg-gradient-to-br from-primary to-accent"
                      : "bg-surface-muted border border-border/70"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary" />
                  )}
                </div>
              )}

              {/* Message bubble */}
              <div
                className={cn(
                  "relative max-w-[85%] text-sm leading-relaxed",
                  msg.isSystem
                    ? "glass rounded-xl px-4 py-2 text-xs text-muted-foreground text-center"
                    : msg.role === "user"
                    ? "bg-gradient-to-r from-primary to-accent text-white rounded-2xl rounded-tr-md px-4 py-3"
                    : "glass-strong rounded-2xl rounded-tl-md px-4 py-3"
                )}
              >
                {msg.tool && (
                  <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-surface-muted border border-border/70 w-fit text-[10px] text-primary/80 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Using {msg.tool}...</span>
                  </div>
                )}
                {msg.role === "assistant" && !msg.isSystem ? (
                  <div className="prose-sm">{renderMarkdown(msg.content)}</div>
                ) : (
                  msg.content
                )}

                {/* Speaker button for assistant messages */}
                {msg.role === "assistant" && !msg.isSystem && (
                  <button
                    onClick={() => handleSpeak(msg.content, i)}
                    className="absolute -right-8 top-2 p-1.5 rounded-full bg-surface-muted hover:bg-surface-hover text-muted-foreground transition-colors"
                    title={speakingIdx === i ? "Stop speaking" : "Read aloud"}
                  >
                    {speakingIdx === i ? <VolumeX className="w-3.5 h-3.5 text-primary" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                )}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/70">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Sources</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary/80 px-2 py-0.5 rounded-full"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expandable chunks */}
                {msg.chunks && msg.chunks.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleChunks(i)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expandedChunks[i] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {expandedChunks[i] ? "Hide" : "View"} retrieved chunks ({msg.chunks.length})
                    </button>
                    {expandedChunks[i] && (
                      <div className="mt-2 space-y-2 animate-fadeIn">
                        {msg.chunks.map((chunk, k) => (
                          <div key={k} className="text-[11px] bg-surface-muted rounded-lg p-2.5 border border-border/70">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-primary/60 font-medium">{chunk.source}</span>
                              {chunk.score && (
                                <span className="text-muted-foreground text-[9px]">
                                  score: {(chunk.score * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <p className="text-muted-foreground line-clamp-3">{chunk.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3 animate-fadeIn">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-muted border border-border/70 flex items-center justify-center mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="glass-strong rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="w-1.5 h-1.5 bg-primary rounded-full"
                      style={{
                        animation: `typingDot 1.4s ease-in-out ${dot * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="px-6 py-4 border-t border-border/70">
        <div className="max-w-3xl mx-auto">
          <div className="glass-strong rounded-xl px-4 py-3 flex items-end gap-3 focus-within:ring-1 focus-within:ring-primary/30 transition-shadow">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.docx,.csv,.xlsx,.xls,.md"
              className="hidden"
              onChange={(e) => {
                onUploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <textarea
              ref={textareaRef}
              placeholder={listening ? "Listening..." : "Ask a question..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              className={cn(
                "flex-1 bg-transparent border-none outline-none resize-none text-sm placeholder:text-muted-foreground/50 max-h-[150px]",
                listening ? "text-primary placeholder:text-primary/70" : ""
              )}
            />
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 flex-shrink-0 transition-colors", listening ? "text-red-400 bg-red-400/10" : "text-muted-foreground hover:text-primary")}
              onClick={handleMicClick}
              disabled={loading || uploading}
            >
              <Mic className={cn("w-4 h-4", listening && "animate-pulse")} />
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-8 w-8 flex-shrink-0 bg-gradient-to-r from-primary to-accent border-0 shadow-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
