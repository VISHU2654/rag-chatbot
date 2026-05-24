import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileDown } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:5000";

export default function ExportButton({ messages }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleExport = async (format) => {
    if (!messages || messages.length === 0) return;
    setExporting(true);
    setOpen(false);

    try {
      const res = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, format }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nexusai_chat.${format === "pdf" ? "pdf" : "md"}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail
    } finally {
      setExporting(false);
    }
  };

  if (!messages || messages.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="text-muted-foreground hover:text-foreground h-8 text-xs"
      >
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Export
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 glass-strong rounded-lg shadow-xl border border-border py-1 z-50 animate-fadeIn">
          <button
            onClick={() => handleExport("markdown")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground/80 hover:bg-surface-hover transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            Export as Markdown
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground/80 hover:bg-surface-hover transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-red-400" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
