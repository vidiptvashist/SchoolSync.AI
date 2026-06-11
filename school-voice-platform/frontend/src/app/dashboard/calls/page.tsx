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

export default function CallsPage() {
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [recentLimit] = useState(20);
  const [recentSkip, setRecentSkip] = useState(0);
  const [hasMoreRecent, setHasMoreRecent] = useState(true);
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  
  // State to trigger local re-render every second to update the duration counters
  const [tick, setTick] = useState(0);

  // Poll live calls every 3 seconds
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

  // Fetch recent calls
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

  useEffect(() => {
    fetchLiveCalls(true);
    fetchRecentCalls(0, false);

    // Live calls polling interval
    const liveInterval = setInterval(() => {
      fetchLiveCalls();
    }, 3000);

    // Dynamic duration counter ticker (1s)
    const tickInterval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => {
      clearInterval(liveInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const loadMoreRecent = () => {
    const nextSkip = recentSkip + recentLimit;
    setRecentSkip(nextSkip);
    fetchRecentCalls(nextSkip, true);
  };

  // Helper to calculate active duration in seconds
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

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "answered" || s === "completed") {
      return <Badge variant="success" className="bg-green-100 text-green-800 border-green-200">Answered</Badge>;
    } else if (s === "missed" || s === "no-answer") {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">Missed</Badge>;
    } else {
      return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Failed</Badge>;
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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

  const getTopicLabel = (topic: string) => {
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
        return "Unknown";
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Call Logs & Live Monitor</h2>
        <p className="text-sm text-slate-500 mt-1">
          Monitor active parent phone calls in real time and view detailed transcripts and logs.
        </p>
      </div>

      {/* Section 1: Live Calls */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <h3 className="text-lg font-bold text-slate-800">
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
                  className="live-card-pulse border bg-white shadow-sm overflow-hidden"
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Card Header: Live Label & Caller Details */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="bg-green-500 text-white animate-pulse text-[10px] uppercase font-bold py-0.5 px-1.5 rounded-md">
                          🟢 LIVE
                        </Badge>
                        <span className="text-sm font-semibold text-slate-800 truncate max-w-[150px]" title={call.parent_name}>
                          {call.parent_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {call.caller_phone}
                      </span>
                    </div>

                    {/* Card Body: Student & Class & Auth Details */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">Child:</span>
                        <span>{call.student_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Class:</span>
                        <span>{call.class_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Authentication:</span>
                        <span className={call.authenticated ? "text-green-600 font-semibold" : "text-amber-600"}>
                          {call.authenticated ? "Authenticated ✓" : "Pending Verification"}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Topic and Live Duration */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Topic</span>
                        <p className="text-xs font-bold text-indigo-600">
                          {getTopicLabel(call.current_topic)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Duration</span>
                        <p className="text-xs font-bold font-mono flex items-center justify-end gap-1 text-slate-800">
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
          <div className="flex flex-col items-center justify-center p-8 border border-slate-100 rounded-xl bg-white text-center">
            <p className="text-sm text-slate-400 font-medium">No active calls right now</p>
          </div>
        )}
      </div>

      {/* Section 2: Recent Calls */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-800">Call History</CardTitle>
          <CardDescription className="text-xs">
            Review history and summaries of inbound calling interactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentCalls.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="w-[10px]"></TableHead>
                    <TableHead className="pl-6 py-3 text-xs font-semibold text-slate-500">Time</TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-slate-500">Parent</TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-slate-500">Student</TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-slate-500">Type</TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-slate-500">Duration</TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-slate-500">Topic</TableHead>
                    <TableHead className="pr-6 py-3 text-xs font-semibold text-slate-500">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCalls.map((log) => {
                    const isExpanded = !!expandedRows[log.id];
                    return (
                      <React.Fragment key={log.id}>
                        {/* Summary Row */}
                        <TableRow 
                          onClick={() => toggleRow(log.id)}
                          className="hover:bg-slate-50/40 cursor-pointer transition-colors"
                        >
                          <TableCell className="pl-4 py-4 text-center">
                            <span className="text-[10px] text-slate-400">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                          </TableCell>
                          <TableCell className="pl-2 py-4 font-mono text-xs text-slate-600">
                            {formatTime(log.created_at)}
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="font-semibold text-slate-800 text-xs">
                              {log.parent_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {log.caller_phone}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-xs font-medium text-slate-700">
                            {log.student_name}
                          </TableCell>
                          <TableCell className="py-4 text-xs uppercase font-semibold text-slate-500">
                            {log.direction}
                          </TableCell>
                          <TableCell className="py-4 font-mono text-xs">
                            {formatDuration(log.duration_seconds)}
                          </TableCell>
                          <TableCell className="py-4 text-xs font-bold text-indigo-600">
                            {getTopicLabel(log.intent)}
                          </TableCell>
                          <TableCell className="pr-6 py-4">
                            {getStatusBadge(log.status)}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                            <TableCell colSpan={8} className="p-4 pl-12 pr-6">
                              <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-inner space-y-2.5">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Call Summary</h4>
                                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                  {log.summary}
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
            <div className="text-center py-12 text-slate-400 text-sm">
              No recent calls recorded yet.
            </div>
          )}

          {/* Load More Button */}
          {recentCalls.length > 0 && hasMoreRecent && (
            <div className="flex justify-center p-4 border-t border-slate-100 bg-white">
              <Button
                variant="outline"
                onClick={loadMoreRecent}
                disabled={loadingRecent}
                className="text-xs border-slate-200 text-slate-600 font-semibold py-1.5 px-4 shadow-sm"
              >
                {loadingRecent ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></span>
                ) : (
                  "Load More Logs"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
