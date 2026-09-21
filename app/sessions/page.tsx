"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Clock,
  FileCheck,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { Button, Card, EmptyState, Field } from "@/app/components/ui";
import { getAuthHeaders, useAuth } from "@/app/components/PasswordGate";
import type { ActiveSession } from "@/lib/activeSessions";

function getRelativeTime(isoString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 15) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatClockTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ActiveSessionsPage() {
  const { role } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [townFilter, setTownFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSessions = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch("/api/sessions", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Admin access required to view active sessions.");
        }
        throw new Error("Failed to load active sessions.");
      }
      const data = await res.json();
      setSessions(data.sessions || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load active sessions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (role === "admin") {
      void fetchSessions(false);
    } else {
      setLoading(false);
    }
  }, [role, fetchSessions]);

  // Periodic polling for real-time live view
  useEffect(() => {
    if (role !== "admin" || !autoRefresh) return;
    const interval = setInterval(() => {
      void fetchSessions(true);
    }, 10_000);
    return () => clearInterval(interval);
  }, [role, autoRefresh, fetchSessions]);

  const handleEndSession = async (id: string, staffName: string) => {
    const confirm = window.confirm(
      `Are you sure you want to end the active session for staff member "${staffName}"?`
    );
    if (!confirm) return;

    try {
      const res = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const handleClearAllSessions = async () => {
    const confirm = window.confirm(
      "Are you sure you want to clear all active sessions from the monitor?"
    );
    if (!confirm) return;

    try {
      const res = await fetch("/api/sessions?id=all", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSessions([]);
      }
    } catch {
      // ignore
    }
  };

  // Unique towns in current sessions for filtering
  const availableTowns = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.town) set.add(s.town);
    }
    return Array.from(set).sort();
  }, [sessions]);

  // Filtered list
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        s.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.town.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.revNo.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTown = townFilter === "all" || s.town === townFilter;
      return matchesSearch && matchesTown;
    });
  }, [sessions, searchQuery, townFilter]);

  // Aggregate metrics
  const totalActive = sessions.filter((s) => s.status === "active").length;
  const totalIdle = sessions.filter((s) => s.status === "idle").length;
  const totalMarks = sessions.reduce((acc, s) => acc + (s.marksCount || 0), 0);

  // If user is a marker, deny access
  if (role === "marker") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-warn/40 bg-warn/10 text-warn">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-title font-semibold text-paper">Access Restricted</h2>
          <p className="mt-2 text-label text-dim">
            You are signed in with the <strong>Paper Marking</strong> role. Only administrators have permission to view active marking sessions and the staff monitoring tab.
          </p>
          <div className="mt-6">
            <Link href="/">
              <Button fullWidth variant="primary">
                Go to Mark Tab
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-title font-semibold text-paper">Active Sessions</h1>
            <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-micro font-medium text-brand">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              {totalActive} Active {totalActive === 1 ? "Marker" : "Markers"}
            </span>
          </div>
          <p className="mt-1 text-label text-dim">
            Real-time monitor of staff members currently marking papers across all towns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="toggle-auto-refresh-btn"
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={[
              "rounded-control border px-2.5 py-1.5 text-micro font-medium transition-colors",
              autoRefresh
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-line bg-surface text-dim hover:text-paper",
            ].join(" ")}
          >
            {autoRefresh ? "Live: 10s" : "Live: Paused"}
          </button>

          <Button
            id="refresh-sessions-btn"
            variant="secondary"
            size="sm"
            onClick={() => void fetchSessions(false)}
            loading={refreshing}
          >
            <RefreshCw className={["h-3.5 w-3.5", refreshing ? "animate-spin" : ""].join(" ")} />
            <span>Refresh</span>
          </Button>

          {sessions.length > 0 && (
            <Button
              id="clear-all-sessions-btn"
              variant="secondary"
              size="sm"
              onClick={() => void handleClearAllSessions()}
              className="text-dim hover:border-warn/40 hover:bg-warn/10 hover:text-warn"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-micro font-medium text-dim">
            <Users className="h-4 w-4 text-brand" />
            <span>Active Staff</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-paper">{totalActive}</div>
          <div className="text-[11px] text-dim">{totalIdle} currently idle</div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-micro font-medium text-dim">
            <MapPin className="h-4 w-4 text-brand" />
            <span>Active Towns</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-paper">{availableTowns.length}</div>
          <div className="text-[11px] text-dim">
            {availableTowns.slice(0, 2).join(", ") || "None"}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-micro font-medium text-dim">
            <FileCheck className="h-4 w-4 text-brand" />
            <span>Papers Marked</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-paper">{totalMarks}</div>
          <div className="text-[11px] text-dim">In current active sessions</div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center gap-2 text-micro font-medium text-dim">
            <Activity className="h-4 w-4 text-brand" />
            <span>Session Status</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-paper">
            {sessions.length > 0 ? "Tracking" : "Idle"}
          </div>
          <div className="text-[11px] text-dim">Auto-syncing heartbeats</div>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <input
            id="active-sessions-search-input"
            type="text"
            placeholder="Search staff name, town, or REV number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-body text-paper placeholder:text-dim focus:border-brand focus:outline-none"
          />
        </div>

        {availableTowns.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-dim shrink-0" />
            <select
              id="active-sessions-town-filter"
              value={townFilter}
              onChange={(e) => setTownFilter(e.target.value)}
              className="rounded-control border border-line bg-surface px-3 py-2 text-label text-paper focus:border-brand focus:outline-none"
            >
              <option value="all">All Towns</option>
              {availableTowns.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-control border border-warn/40 bg-warn/10 p-3 text-label text-warn">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Session list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse p-4">
              <div className="h-5 w-48 rounded bg-surface-2" />
              <div className="mt-3 flex gap-2">
                <div className="h-4 w-24 rounded bg-surface-2" />
                <div className="h-4 w-20 rounded bg-surface-2" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          title={sessions.length === 0 ? "No active marking sessions" : "No matching sessions"}
          hint={
            sessions.length === 0
              ? "When staff members start marking papers on their devices, their staff names, assigned town, and live progress will show here automatically."
              : "Try adjusting your search query or town filter."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredSessions.map((s) => {
            const isActive = s.status === "active";
            return (
              <Card
                key={s.id}
                className="flex flex-col gap-3 transition-colors hover:border-dim"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-brand">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      {/* Prominent Staff Name */}
                      <div className="flex items-center gap-2">
                        <span className="text-body font-semibold text-paper">
                          {s.staffName}
                        </span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-dim">
                          Staff
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-dim">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-dim" />
                          <span className="text-paper">{s.town}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <FileCheck className="h-3 w-3 text-dim" />
                          <span className="text-paper">{s.revNo}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Last Active */}
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="flex flex-col items-end text-right">
                      {isActive ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-micro font-medium text-brand">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                          </span>
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-micro font-medium text-dim">
                          <Clock className="h-3 w-3" />
                          Idle
                        </span>
                      )}
                      <span className="text-[11px] text-dim">
                        Active {getRelativeTime(s.lastActiveAt)}
                      </span>
                    </div>

                    <button
                      type="button"
                      title="End this session"
                      onClick={() => void handleEndSession(s.id, s.staffName)}
                      className="rounded-control border border-line p-2 text-dim hover:border-warn hover:bg-warn/10 hover:text-warn transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Session Footer Details */}
                <div className="flex flex-wrap items-center justify-between border-t border-line/60 pt-2.5 text-micro text-dim">
                  <div className="flex items-center gap-3">
                    <span>
                      Started:{" "}
                      <strong className="text-paper font-medium">
                        {formatClockTime(s.startedAt)} ({getRelativeTime(s.startedAt)})
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-brand">
                      {s.marksCount || 0}
                    </span>
                    <span>papers marked in this session</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
