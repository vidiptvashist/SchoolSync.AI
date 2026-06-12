"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { MessageSquare, Phone, Clock, Loader2, ArrowUpRight, RefreshCw } from "lucide-react";

interface LiveCall {
  call_sid: string;
  caller_phone: string;
  parent_name: string;
  student_name: string;
  class_name: string;
  authenticated: boolean;
  current_topic: string;
  started_at: string;
  duration_seconds: number;
}

interface RecentCall {
  id: string;
  caller_phone: string;
  parent_name: string;
  student_name: string;
  direction: string;
  status: string;
  duration_seconds: number;
  intent: string;
  summary: string;
  created_at: string;
}

interface ActiveChat {
  id: string;
  parent_phone: string;
  parent_name: string | null;
  student_name: string | null;
  class_name: string | null;
  message_count: number;
  last_message_content: string | null;
  last_message_created_at: string | null;
  started_at: string;
}

interface ChatSession {
  id: string;
  parent_phone: string;
  parent_name: string | null;
  student_name: string | null;
  class_name: string | null;
  status: string;
  message_count: number;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  intent: string | null;
  created_at: string;
}

export default function CallsPage() {
  const [activeTab, setActiveTab] = useState<"calls" | "chats">("calls");

  // Call lists state
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [recentLimit] = useState(20);
  const [recentSkip, setRecentSkip] = useState(0);
  const [hasMoreRecent, setHasMoreRecent] = useState(true);
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Chat lists state
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [loadingActiveChats, setLoadingActiveChats] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Transcript Sheet state
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  
  // Ticker trigger
  const [tick, setTick] = useState(0);

  // ──────────────── VOICE CALLS EFFECTS ────────────────

  const fetchLiveCalls = async (showLoading = false) => {
    if (showLoading) setLoadingLive(true);
    try {
      const response = await api.get("/voice/calls/live");
      setLiveCalls(response.data);
    } catch (error) {
      console.error("Failed to fetch live calls:", error);
    } finally {
      if (showLoading) setLoadingLive(false);
    }
  };

  const fetchRecentCalls = async (skipCount = 0, append = false) => {
    setLoadingRecent(true);
    try {
      const response = await api.get(`/voice/calls/recent?limit=${recentLimit}&skip=${skipCount}`);
      const data = response.data;
      if (data.length < recentLimit) {
        setHasMoreRecent(false);
      } else {
        setHasMoreRecent(true);
      }

      if (append) {
        setRecentCalls((prev) => [...prev, ...data]);
      } else {
        setRecentCalls(data);
      }
    } catch (error) {
      console.error("Failed to fetch recent calls:", error);
      toast.error("Failed to fetch call logs");
    } finally {
      setLoadingRecent(false);
    }
  };

  // ──────────────── CHAT SESSIONS EFFECTS ────────────────

  const fetchActiveChats = async (showLoading = false) => {
    if (showLoading) setLoadingActiveChats(true);
    try {
      const res = await api.get("/chat/sessions/active");
      setActiveChats(res.data);
    } catch (error) {
      console.error("Failed to fetch active chats:", error);
    } finally {
      setLoadingActiveChats(false);
    }
  };

  const fetchChatHistory = async () => {
    setLoadingHistory(true);
    try {
      // Fetch historic ended sessions primarily
      const res = await api.get("/chat/sessions");
      setChatHistory(res.data);
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
      toast.error("Failed to fetch chat log history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const openChatTranscript = async (chat: ChatSession) => {
    setSelectedChat(chat);
    setChatMessages([]);
    setIsTranscriptOpen(true);
    setLoadingTranscript(true);
    try {
      const res = await api.get(`/chat/sessions/${chat.id}/messages`);
      setChatMessages(res.data);
    } catch (error) {
      console.error("Failed to load chat messages:", error);
      toast.error("Failed to load conversation transcript");
    } finally {
      setLoadingTranscript(false);
    }
  };

  // ──────────────── RECURRING POLLING ────────────────

  useEffect(() => {
    // Standard durational counters ticker (1s)
    const tickInterval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(tickInterval);
  }, []);

  useEffect(() => {
    if (activeTab === "calls") {
      fetchLiveCalls(true);
      fetchRecentCalls(0, false);

      const liveInterval = setInterval(() => {
        fetchLiveCalls();
      }, 3000);

      return () => clearInterval(liveInterval);
    } else {
      fetchActiveChats(true);
      fetchChatHistory();

      // Poll active chats every 5 seconds
      const activeChatsInterval = setInterval(() => {
        fetchActiveChats();
      }, 5000);

      return () => clearInterval(activeChatsInterval);
    }
  }, [activeTab]);

  const loadMoreRecent = () => {
    const nextSkip = recentSkip + recentLimit;
    setRecentSkip(nextSkip);
    fetchRecentCalls(nextSkip, true);
  };

  // ──────────────── FORMATTERS & HELPERS ────────────────

  const calculateLiveDuration = (startedAtStr: string) => {
    if (!startedAtStr) return 0;
    try {
      const startedAt = new Date(startedAtStr).getTime();
      const diffSecs = Math.floor((Date.now() - startedAt) / 1000);
      return diffSecs > 0 ? diffSecs : 0;
    } catch (e) {
      return 0;
    }
  };

  const calculateSessionDuration = (startedStr: string, endedStr: string | null) => {
    try {
      const start = new Date(startedStr).getTime();
      const end = endedStr ? new Date(endedStr).getTime() : Date.now();
      const diffSecs = Math.floor((end - start) / 1000);
      return diffSecs > 0 ? diffSecs : 0;
    } catch (e) {
      return 0;
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeAgo = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      const remSecs = diffSecs % 60;
      return `${diffMins}:${remSecs.toString().padStart(2, "0")} ago`;
    } catch (e) {
      return "";
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "answered" || s === "completed") {
      return <Badge className="bg-green-100 dark:bg-green-500/10 text-green-800 dark:text-green-400 border-green-200 dark:border-green-500/20">Answered</Badge>;
    } else if (s === "missed" || s === "no-answer") {
      return <Badge className="bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-200 dark:border-red-500/20">Missed</Badge>;
    } else {
      return <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">Failed</Badge>;
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + 
             " | " + 
             date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  };

  const getTopicLabel = (topic?: string | null) => {
    if (!topic) return "General Chat";
    switch (topic.toLowerCase()) {
      case "general_faq":
        return "General FAQ";
      case "attendance_query":
        return "Attendance";
      case "fee_query":
        return "Fee Query";
      case "human_transfer":
        return "Staff Handoff";
      default:
        return topic.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Session Logs & Live Monitor</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor real-time voice calls and text-based parent AI chat sessions.
          </p>
        </div>

        {/* Tab switch bar */}
        <div className="flex bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab("calls")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeTab === "calls"
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Phone className="h-3.5 w-3.5" />
            Calls
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeTab === "chats"
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chats
          </button>
        </div>
      </div>

      {activeTab === "calls" ? (
        <>
          {/* CALLS TAB - Section 1: Live Calls */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Live Calls ({liveCalls.length})
              </h3>
            </div>

            {liveCalls.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {liveCalls.map((call) => {
                  const liveDuration = calculateLiveDuration(call.started_at);
                  return (
                    <Card 
                      key={call.call_sid} 
                      className="glass-panel shadow-sm overflow-hidden"
                    >
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-500 text-white animate-pulse text-[10px] uppercase font-bold py-0.5 px-1.5 rounded-md">
                              🟢 LIVE
                            </Badge>
                            <span className="text-sm font-semibold text-slate-800 dark:text-white truncate max-w-[150px]" title={call.parent_name}>
                              {call.parent_name || "Unknown Parent"}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {call.caller_phone}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium">Child:</span>
                            <span>{call.student_name || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Class:</span>
                            <span>{call.class_name || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Authentication:</span>
                            <span className={call.authenticated ? "text-green-600 dark:text-green-400 font-semibold" : "text-amber-600 dark:text-amber-400"}>
                              {call.authenticated ? "Authenticated ✓" : "Pending Verification"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Current Topic</span>
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              {getTopicLabel(call.current_topic)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Duration</span>
                            <p className="text-xs font-bold font-mono flex items-center justify-end gap-1 text-slate-800 dark:text-white">
                              {formatDuration(liveDuration)}
                              <span className="text-green-500 font-bold">↑</span>
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border border-slate-100 dark:border-slate-700 rounded-xl glass-panel text-center shadow-xs">
                <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">No active calls right now</p>
              </div>
            )}
          </div>

          {/* CALLS TAB - Section 2: Call History */}
          <Card className="glass-panel shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-700">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Call History</CardTitle>
              <CardDescription className="text-xs dark:text-slate-400">
                Review history and summaries of inbound calling interactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {recentCalls.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/30">
                        <TableHead className="w-[10px]"></TableHead>
                        <TableHead className="pl-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Time</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Parent</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Student</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Type</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Duration</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Topic</TableHead>
                        <TableHead className="pr-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCalls.map((log) => {
                        const isExpanded = !!expandedRows[log.id];
                        return (
                          <React.Fragment key={log.id}>
                            <TableRow 
                              onClick={() => toggleRow(log.id)}
                              className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                            >
                              <TableCell className="pl-4 py-4 text-center">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                              </TableCell>
                              <TableCell className="pl-2 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                                {formatTime(log.created_at)}
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="font-semibold text-slate-800 dark:text-white text-xs">
                                  {log.parent_name || "Unknown Parent"}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                  {log.caller_phone}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                                {log.student_name || "N/A"}
                              </TableCell>
                              <TableCell className="py-4 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
                                {log.direction}
                              </TableCell>
                              <TableCell className="py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                                {formatDuration(log.duration_seconds)}
                              </TableCell>
                              <TableCell className="py-4 text-xs font-bold text-amber-600 dark:text-amber-400">
                                {getTopicLabel(log.intent)}
                              </TableCell>
                              <TableCell className="pr-6 py-4">
                                {getStatusBadge(log.status)}
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="bg-slate-50/30 dark:bg-slate-800/20 hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                                <TableCell colSpan={8} className="p-4 pl-12 pr-6">
                                  <div className="glass-panel rounded-xl p-4 shadow-inner space-y-2.5">
                                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">AI Call Summary</h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium font-sans">
                                      {log.summary || "No summary generated for this call."}
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                  No recent calls recorded yet.
                </div>
              )}

              {recentCalls.length > 0 && hasMoreRecent && (
                <div className="flex justify-center p-4 border-t border-slate-100 dark:border-slate-700">
                  <Button
                    variant="outline"
                    onClick={loadMoreRecent}
                    disabled={loadingRecent}
                    className="text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold py-1.5 px-4 shadow-sm"
                  >
                    {loadingRecent ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Load More Logs"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* CHATS TAB - Section 1: Active Chats */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Active Chats ({activeChats.length})
              </h3>
            </div>

            {activeChats.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeChats.map((chat) => (
                  <Card 
                    key={chat.id} 
                    className="glass-panel shadow-sm overflow-hidden"
                  >
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-500 text-white animate-pulse text-[10px] uppercase font-bold py-0.5 px-1.5 rounded-md">
                            💬 LIVE
                          </Badge>
                          <span className="text-sm font-semibold text-slate-800 dark:text-white truncate max-w-[150px]" title={chat.parent_name || ""}>
                            {chat.parent_name || "Priya Sharma"}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {chat.parent_phone}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">Child:</span>
                          <span>{chat.student_name || "Pending OTP Auth"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Class:</span>
                          <span>{chat.class_name || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Messages:</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{chat.message_count}</span>
                        </div>
                      </div>

                      {chat.last_message_content && (
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-3 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
                          <span className="truncate max-w-[200px] text-slate-600 dark:text-slate-300 italic" title={chat.last_message_content}>
                            Last: &quot;{chat.last_message_content}&quot;
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap ml-2">
                            {formatTimeAgo(chat.last_message_created_at || chat.started_at)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border border-slate-100 dark:border-slate-700 rounded-xl glass-panel text-center shadow-xs">
                <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">No active parent chats right now</p>
              </div>
            )}
          </div>

          {/* CHATS TAB - Section 2: Chat History */}
          <Card className="glass-panel shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-700">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Chat Session History</CardTitle>
              <CardDescription className="text-xs dark:text-slate-400">
                Review previous messaging transcript records and summaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {chatHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/30">
                        <TableHead className="pl-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Time</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Parent</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Student</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Messages</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Last Topic</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Duration</TableHead>
                        <TableHead className="pr-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chatHistory.map((sess) => {
                        const duration = calculateSessionDuration(sess.started_at, sess.ended_at);
                        return (
                          <TableRow key={sess.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                            <TableCell className="pl-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                              {formatTime(sess.started_at)}
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="font-semibold text-slate-800 dark:text-white text-xs">
                                {sess.parent_name || "Unknown Parent"}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                {sess.parent_phone}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                              {sess.student_name || "N/A"}
                            </TableCell>
                            <TableCell className="py-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                              {sess.message_count} msgs
                            </TableCell>
                            <TableCell className="py-4 text-xs font-bold text-amber-600 dark:text-amber-400">
                              {sess.summary ? getTopicLabel("general_faq") : "N/A"}
                            </TableCell>
                            <TableCell className="py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                              {formatDuration(duration)}
                            </TableCell>
                            <TableCell className="pr-6 py-4 text-right">
                              <Button
                                onClick={() => openChatTranscript(sess)}
                                variant="outline"
                                size="sm"
                                className="text-xs border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-50/50 dark:hover:bg-amber-500/10"
                              >
                                View Transcript
                                <ArrowUpRight className="ml-1.5 h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                  No previous chat history logged.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Slide-over Transcript Panel */}
      <Sheet open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
        <SheetContent className="max-w-md w-full h-full flex flex-col p-6 bg-white dark:bg-[#0f1729] border-l border-slate-200 dark:border-slate-800 shadow-2xl">
          <SheetHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
            <SheetTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Chat Transcript
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              Parent phone: {selectedChat?.parent_phone}
              {selectedChat?.parent_name && ` • ${selectedChat.parent_name}`}
            </SheetDescription>
          </SheetHeader>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {loadingTranscript ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            ) : chatMessages.length > 0 ? (
              chatMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div 
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? "bg-amber-500 text-slate-950 rounded-tr-none shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700 rounded-tl-none shadow-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Intent badge on Assistant message */}
                      {!isUser && msg.intent && (
                        <div className="mt-2 flex justify-end">
                          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-amber-100 dark:border-amber-500/20">
                            🏷️ {msg.intent.replace("_", " ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-semibold">
                No transcript messages found.
              </div>
            )}
          </div>

          {/* Slide-over Footer Session Summary */}
          {selectedChat?.summary && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl shrink-0 mt-auto">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                AI Session Summary
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed mt-1">
                {selectedChat.summary}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
