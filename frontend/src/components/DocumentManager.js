import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Globe,
  Trash2,
  Loader2,
  File,
  CheckCircle,
  AlertCircle,
  Link,
  FolderOpen,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:5000";

const FORMAT_BADGES = [
  { ext: ".pdf", color: "text-red-400 bg-red-400/10", label: "PDF" },
  { ext: ".txt", color: "text-blue-400 bg-blue-400/10", label: "TXT" },
  { ext: ".docx", color: "text-sky-400 bg-sky-400/10", label: "DOCX" },
  { ext: ".csv", color: "text-green-400 bg-green-400/10", label: "CSV" },
  { ext: ".xlsx", color: "text-emerald-400 bg-emerald-400/10", label: "XLSX" },
  { ext: ".md", color: "text-purple-400 bg-purple-400/10", label: "MD" },
];

export default function DocumentManager({ documents, onRefresh, onToast }) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState(1);
  const [ingestingUrl, setIngestingUrl] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef(null);

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    try {
      const res = await fetch(`${API_BASE}/ingest`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.chunks_created) {
        onToast(`Ingested ${data.files_processed} file(s) -> ${data.chunks_created} chunks`, "success");
      } else {
        onToast(data.error || "Upload failed", "error");
      }
      onRefresh();
    } catch {
      onToast("Upload failed. Is the backend running?", "error");
    } finally {
      setUploading(false);
    }
  };

  const ingestUrl = async () => {
    if (!url.trim()) return;
    setIngestingUrl(true);
    try {
      const res = await fetch(`${API_BASE}/ingest-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), depth }),
      });
      const data = await res.json();
      if (data.chunks_created) {
        onToast(`Ingested URL -> ${data.chunks_created} chunks`, "success");
        setUrl("");
      } else {
        onToast(data.error || "URL ingestion failed", "error");
      }
      onRefresh();
    } catch {
      onToast("URL ingestion failed", "error");
    } finally {
      setIngestingUrl(false);
    }
  };

  const clearDocs = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setClearing(true);
    try {
      await fetch(`${API_BASE}/clear`, { method: "POST" });
      onToast("All documents cleared", "success");
      onRefresh();
    } catch {
      onToast("Failed to clear documents", "error");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold gradient-text">Document Manager</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents to build your knowledge base
          </p>
        </div>

        {/* Supported formats */}
        <div className="flex flex-wrap gap-2">
          {FORMAT_BADGES.map((f) => (
            <span key={f.ext} className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium", f.color)}>
              {f.label}
            </span>
          ))}
        </div>

        {/* Upload drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "glass rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200",
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/40 hover:bg-surface-muted"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.docx,.csv,.xlsx,.xls,.md"
            className="hidden"
            onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
          />
          <div className="flex flex-col items-center gap-3">
            {uploading ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium">
                {uploading ? "Uploading..." : "Drop files here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, TXT, DOCX, CSV, XLSX, Markdown
              </p>
            </div>
          </div>
        </div>

        {/* URL ingestion */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Ingest from URL</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-surface-muted border-border flex-1"
              onKeyDown={(e) => e.key === "Enter" && ingestUrl()}
            />
            <Button
              onClick={ingestUrl}
              disabled={ingestingUrl || !url.trim()}
              className="bg-gradient-to-r from-primary to-accent border-0"
            >
              {ingestingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
              <span className="ml-2">Ingest</span>
            </Button>
          </div>
          <div className="flex items-center gap-4 px-1">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground font-medium">Crawl Depth</label>
                <span className="text-xs text-primary font-medium">{depth}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={depth}
                onChange={(e) => setDepth(parseInt(e.target.value))}
                className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Depth 1 = Single page. Depth 2 = Links on page. (Higher depths take much longer)
              </p>
            </div>
          </div>
        </div>

        {/* Document list */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">
                Knowledge Base
                {documents.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({documents.length} document{documents.length !== 1 ? "s" : ""})
                  </span>
                )}
              </h3>
            </div>
            {documents.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDocs}
                disabled={clearing}
                className={cn(
                  "text-xs h-8",
                  confirmClear ? "text-red-400 hover:text-red-300 bg-red-400/10" : "text-muted-foreground hover:text-red-400"
                )}
              >
                {clearing ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-3 h-3 mr-1" />
                )}
                {confirmClear ? "Click again to confirm" : "Clear all"}
              </Button>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No documents yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Upload files or ingest a URL to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, i) => {
                const name = typeof doc === "string" ? doc : doc.name;
                const chunks = typeof doc === "object" ? doc.chunks : null;
                const ext = name.split(".").pop()?.toLowerCase();
                const badge = FORMAT_BADGES.find((f) => f.ext === `.${ext}`);
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-muted hover:bg-surface-hover transition-colors group">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold", badge?.color || "text-muted-foreground bg-muted")}>
                      {badge?.label || ext?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      {chunks && <p className="text-[10px] text-muted-foreground">{chunks} chunks</p>}
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-400/60 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
