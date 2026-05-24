import { useState, useEffect } from "react";
import {
  Settings,
  Cpu,
  Database,
  Brain,
  Activity,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import ThemeSwitcher from "./ThemeSwitcher";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:5000";

function SettingSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full border transition-colors",
        checked
          ? "border-primary bg-primary"
          : "border-border bg-muted hover:bg-surface-hover"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export default function SettingsPanel({ settings, onSettingsChange, onToast }) {
  const [providers, setProviders] = useState([]);
  const [healthOk, setHealthOk] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchProviders();
    checkHealth();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/providers`);
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {}
  };

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE}/health`);
      setHealthOk(res.ok);
    } catch {
      setHealthOk(false);
    } finally {
      setChecking(false);
    }
  };

  const update = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold gradient-text">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure your AI assistant</p>
        </div>

        {/* Appearance */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Appearance</h3>
              <p className="text-[10px] text-muted-foreground mt-1">
                Choose a light, dark, or Dracula color scheme
              </p>
            </div>
            <ThemeSwitcher
              value={settings.theme || "dark"}
              onChange={(theme) => update("theme", theme)}
            />
          </div>
        </div>

        {/* Model Configuration */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Model Configuration</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Provider</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["groq", "grok", "openai", "ollama"].map((p) => {
                  const pInfo = providers.find((x) => x.name === p);
                  const available = pInfo?.available ?? false;
                  return (
                    <button
                      key={p}
                      onClick={() => update("provider", p)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                        settings.provider === p
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : available
                          ? "border-border text-muted-foreground hover:bg-surface-hover"
                          : "border-border text-muted-foreground/40 opacity-50"
                      )}
                    >
                      <div className="capitalize">{p}</div>
                      <div className="text-[9px] mt-0.5 opacity-60">
                        {available ? "Available" : "Not configured"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Model Name</label>
              <Input
                value={settings.model || ""}
                onChange={(e) => update("model", e.target.value)}
                placeholder="e.g., llama-3.3-70b-versatile"
                className="bg-surface-muted border-border"
              />
            </div>
          </div>
        </div>

        {/* RAG Settings */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">RAG Configuration</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground font-medium">Retrieved Chunks</label>
                <span className="text-xs text-primary font-medium">{settings.ragK || 4}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={settings.ragK || 4}
                onChange={(e) => update("ragK", parseInt(e.target.value))}
                className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/50 mt-0.5">
                <span>Fewer (faster)</span>
                <span>More (thorough)</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Hybrid Search</p>
                <p className="text-[10px] text-muted-foreground">Combine vector + keyword search</p>
              </div>
              <SettingSwitch
                label="Hybrid Search"
                checked={!!settings.hybridSearch}
                onChange={(checked) => update("hybridSearch", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Re-ranking</p>
                <p className="text-[10px] text-muted-foreground">Cross-encoder re-ranking for better relevance</p>
              </div>
              <SettingSwitch
                label="Re-ranking"
                checked={!!settings.reranker}
                onChange={(checked) => update("reranker", checked)}
              />
            </div>
          </div>
        </div>

        {/* Memory Settings */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Conversation Memory</h3>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted-foreground font-medium">Memory Window (turns)</label>
              <span className="text-xs text-primary font-medium">{settings.memoryWindow || 10}</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              value={settings.memoryWindow || 10}
              onChange={(e) => update("memoryWindow", parseInt(e.target.value))}
              className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>

        {/* Backend Status */}
        <div className="glass-strong rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">System Status</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {checking ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : healthOk ? (
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-red-400" />
              )}
              <span className="text-sm">
                Backend {healthOk === null ? "..." : healthOk ? "Connected" : "Offline"}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={checkHealth} className="text-xs text-muted-foreground">
              Refresh
            </Button>
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground/60">
            NexusAI v2.0 / Powered by LangChain + ChromaDB
          </div>
        </div>
      </div>
    </div>
  );
}
