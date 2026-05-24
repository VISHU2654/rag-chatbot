import { useState } from "react";
import {
  MessageSquare,
  FileText,
  Image,
  Settings,
  Plus,
  Menu,
  X,
  Sparkles,
  LogOut,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "images", label: "Image Studio", icon: Image },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  activeView,
  onViewChange,
  sessions,
  activeSession,
  onNewChat,
  onSelectSession,
  user,
  onLogout,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id) => {
    onViewChange(id);
    setMobileOpen(false);
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-border/70">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg glow-sm">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold gradient-text tracking-tight">NexusAI</h1>
          <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Document Assistant</p>
        </div>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden p-1 rounded-md hover:bg-surface-hover text-muted-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/15 text-primary shadow-sm glow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-border/70" />

      {/* Chat Sessions */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Chats</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onNewChat(); setMobileOpen(false); }}
            className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground/60 px-2 py-3 text-center">No conversations yet</p>
          )}
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => { onSelectSession(session.id); setMobileOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-xs transition-all duration-150 group",
                session.id === activeSession
                  ? "bg-surface-hover text-foreground"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground/80"
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3 h-3 flex-shrink-0 opacity-50" />
                <span className="truncate flex-1">{session.name || "New Chat"}</span>
              </div>
              {session.created_at && (
                <div className="flex items-center gap-1 mt-0.5 ml-5 opacity-0 group-hover:opacity-60 transition-opacity">
                  <Clock className="w-2.5 h-2.5" />
                  <span className="text-[10px]">
                    {new Date(session.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* User section */}
      {user && (
        <div className="px-3 py-3 border-t border-border/70">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center text-xs font-bold text-primary">
              {user.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.username}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass hover:bg-surface-hover transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-[280px] glass-strong flex-shrink-0 transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebar}
      </aside>
    </>
  );
}
