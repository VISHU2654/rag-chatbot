import { useState } from "react";
import { X, LogIn, UserPlus, Loader2, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:5000";

export default function AuthModal({ onAuth, onClose }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("All fields are required.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/login" : "/register";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.token) {
        localStorage.setItem("nexusai_token", data.token);
        onAuth(data.user, data.token);
      }
    } catch {
      setError("Connection failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/45 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass-strong rounded-2xl p-8 w-full max-w-sm mx-4 animate-slideUp">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3 glow-sm">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold gradient-text">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "login" ? "Sign in to NexusAI" : "Join NexusAI"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 bg-surface-muted rounded-lg">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={cn(
              "flex-1 py-2 rounded-md text-xs font-medium transition-all",
              mode === "login" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LogIn className="w-3 h-3 inline mr-1" />
            Login
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={cn(
              "flex-1 py-2 rounded-md text-xs font-medium transition-all",
              mode === "register" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UserPlus className="w-3 h-3 inline mr-1" />
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-surface border-border"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface border-border"
          />
          {mode === "register" && (
            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-surface border-border animate-fadeIn"
            />
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg animate-fadeIn">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-accent border-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
