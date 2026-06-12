"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Campaign {
  id: string;
  name: string;
  notice_id: string;
  target_type: string;
  target_filter: any;
  status: "pending" | "running" | "completed" | "failed";
  total_calls: number;
  answered_calls: number;
  scheduled_at: string | null;
  created_at: string;
}

interface CallLog {
  id: string;
  caller_phone: string;
  direction: string;
  status: "dialing" | "answered" | "missed" | "busy" | "failed";
  duration_seconds: number;
  intent: string | null;
  summary: string | null;
  created_at: string;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const campResponse = await api.get(`/campaigns/${campaignId}`);
      setCampaign(campResponse.data);

      const logsResponse = await api.get(`/campaigns/${campaignId}/logs`);
      setLogs(logsResponse.data);
    } catch (error) {
      toast.error("Failed to load campaign execution details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  // Polling: refresh every 2 seconds if the campaign is currently running
  useEffect(() => {
    if (!campaign || campaign.status !== "running") return;

    const interval = setInterval(() => {
      fetchData();
    }, 2000);

    return () => clearInterval(interval);
  }, [campaign]);

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading execution logs...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Campaign not found</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">This campaign register does not exist or has been deleted.</p>
        <Link href="/dashboard/campaigns" className="mt-4 inline-block">
          <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all">
            Back to campaigns
          </Button>
        </Link>
      </div>
    );
  }

  // Dynamically group stats from individual logs
  const dialingCount = logs.filter(log => log.status === "dialing").length;
  const activeCount = logs.filter(log => log.status === "answered" && log.duration_seconds === 0 && (!log.summary || log.summary.trim() === "")).length;
  const completedCount = logs.filter(log => log.status === "answered" && (log.duration_seconds > 0 || (log.summary && log.summary.trim() !== ""))).length;
  const failedCount = logs.filter(log => log.status !== "dialing" && log.status !== "answered").length;
  
  const denom = logs.length || campaign.total_calls || 1;
  const dialingPct = Math.round((dialingCount / denom) * 100);
  const activePct = Math.round((activeCount / denom) * 100);
  const completedPct = Math.round((completedCount / denom) * 100);
  const failedPct = Math.round((failedCount / denom) * 100);

  const completionPct = campaign.total_calls > 0
    ? Math.round((campaign.answered_calls / campaign.total_calls) * 100)
    : 0;

  const Waveform = () => (
    <div className="flex items-end gap-[2.5px] h-4 items-center justify-center">
      <div className="wave-bar w-[2.5px] bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ animationDelay: "0.1s", height: "6px" }} />
      <div className="wave-bar w-[2.5px] bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ animationDelay: "0.3s", height: "12px" }} />
      <div className="wave-bar w-[2.5px] bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ animationDelay: "0.5s", height: "8px" }} />
      <div className="wave-bar w-[2.5px] bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ animationDelay: "0.2s", height: "10px" }} />
      <div className="wave-bar w-[2.5px] bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ animationDelay: "0.4s", height: "5px" }} />
    </div>
  );

  const getCampaignStatusBadge = (status: Campaign["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning">🟡 Pending</Badge>;
      case "running":
        return <Badge variant="info">🔵 Running</Badge>;
      case "completed":
        return <Badge variant="success">🟢 Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">🔴 Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLogCategory = (log: CallLog): "dialing" | "active" | "completed" | "failed" => {
    if (log.status === "dialing") return "dialing";
    if (log.status === "answered") {
      if (log.duration_seconds === 0 && (!log.summary || log.summary.trim() === "")) {
        return "active";
      }
      return "completed";
    }
    return "failed";
  };

  const getCallStatusBadge = (log: CallLog) => {
    const category = getLogCategory(log);
    switch (category) {
      case "dialing":
        return (
          <Badge variant="warning" className="animate-pulse bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
            Dialing
          </Badge>
        );
      case "active":
        return (
          <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5 w-fit animate-pulse">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            Active Listening
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Answered
          </Badge>
        );
      case "failed":
        if (log.status === "missed") {
          return <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 w-fit">⚪ Missed</Badge>;
        }
        if (log.status === "busy") {
          return <Badge variant="info" className="bg-blue-500/10 text-blue-500 border border-blue-500/20 w-fit">🔵 Busy</Badge>;
        }
        return <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border border-rose-500/20 w-fit">🔴 Failed</Badge>;
      default:
        return <Badge variant="outline" className="w-fit">{log.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn duration-300">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wave-pulse {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        .wave-bar {
          animation: wave-pulse 1.2s ease-in-out infinite;
        }
      `}} />
      
      {/* Header section with back button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/campaigns" className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline">
              ← Back to Campaigns
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{campaign.name}</h2>
            {getCampaignStatusBadge(campaign.status)}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Registered on {new Date(campaign.created_at).toLocaleString()}
          </p>
        </div>
        
        <Button
          onClick={fetchData}
          variant="outline"
          className="border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900/60 shadow-sm"
        >
          Refresh Logs
        </Button>
      </div>

      {/* Campaign Stats Overview Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Calls */}
        <Card className="glass-panel border-slate-200 dark:border-slate-800/80 shadow-md">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Targets</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{campaign.total_calls}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Numbers resolved for broadcast</p>
          </CardContent>
        </Card>

        {/* Dialing & Active */}
        <Card className="glass-panel border-slate-200 dark:border-slate-800/80 shadow-md">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dialing & Listening</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-extrabold text-amber-500 font-mono flex items-center gap-1.5">
                  {dialingCount}
                  {dialingCount > 0 && <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-450 font-bold uppercase tracking-wider">Dialing</p>
              </div>
              <div className="border-l border-slate-200 dark:border-slate-800 h-8 self-center mx-2" />
              <div>
                <p className="text-3xl font-extrabold text-emerald-500 font-mono flex items-center gap-1.5">
                  {activeCount}
                  {activeCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-450 font-bold uppercase tracking-wider">Listening</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Answered Calls */}
        <Card className="glass-panel border-slate-200 dark:border-slate-800/80 shadow-md">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed Calls</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{completedCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Successfully completed Q&A</p>
          </CardContent>
        </Card>

        {/* Failed / Missed Calls */}
        <Card className="glass-panel border-slate-200 dark:border-slate-800/80 shadow-md">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Failed / Missed</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-3xl font-extrabold text-rose-500 font-mono">{failedCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Busy, missed, or failed calls</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Broadcast Progress Visualizer */}
      {campaign.status === "running" || logs.length > 0 ? (
        <Card className="glass-panel border-slate-200 dark:border-slate-800/80 shadow-md">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Campaign Broadcast Progress</span>
              <span className="text-xs font-extrabold text-amber-500 dark:text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {Math.round(((completedCount + failedCount) / denom) * 100)}% Dispatched
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="w-full bg-slate-100 dark:bg-slate-950 h-3 rounded-full overflow-hidden mt-2 border border-slate-200 dark:border-slate-850 flex">
              {completedCount > 0 && (
                <div
                  className="bg-emerald-500 h-full transition-all duration-300 relative"
                  style={{ width: `${completedPct}%` }}
                  title={`Completed: ${completedCount} (${completedPct}%)`}
                />
              )}
              {activeCount > 0 && (
                <div
                  className="bg-emerald-400 h-full transition-all duration-300 relative animate-pulse"
                  style={{ width: `${activePct}%` }}
                  title={`Active Listening: ${activeCount} (${activePct}%)`}
                />
              )}
              {dialingCount > 0 && (
                <div
                  className="bg-amber-400 h-full transition-all duration-300 relative"
                  style={{ width: `${dialingPct}%` }}
                  title={`Dialing: ${dialingCount} (${dialingPct}%)`}
                />
              )}
              {failedCount > 0 && (
                <div
                  className="bg-rose-500 h-full transition-all duration-300 relative"
                  style={{ width: `${failedPct}%` }}
                  title={`Missed/Failed: ${failedCount} (${failedPct}%)`}
                />
              )}
            </div>
            
            {/* Progress Legend */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 mt-4 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-emerald-500 shrink-0" />
                <span>Completed ({completedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-emerald-400 animate-pulse shrink-0" />
                <span>Active Listening ({activeCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-amber-400 shrink-0" />
                <span>Dialing ({dialingCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-rose-500 shrink-0" />
                <span>Unanswered / Failed ({failedCount})</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Call Logs Table */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Individual Call History</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Detailed list of calls made for this campaign</p>
        </div>

        <div className="glass-panel border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
              <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] w-[20%]">Parent Phone</TableHead>
                <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] w-[15%]">Call Status</TableHead>
                <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] w-[15%] text-center">Duration</TableHead>
                <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] w-[20%]">Intent Classified</TableHead>
                <TableHead className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] w-[30%]">Notice / Call Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => {
                  const category = getLogCategory(log);
                  return (
                    <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 border-b border-slate-100 dark:border-slate-850 transition-all">
                      <TableCell className="font-bold text-slate-900 dark:text-white font-mono">{log.caller_phone}</TableCell>
                      <TableCell>{getCallStatusBadge(log)}</TableCell>
                      <TableCell className="text-center font-mono text-slate-700 dark:text-slate-300 font-semibold">
                        {category === "active" ? (
                          <div className="inline-flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-450">
                            <span className="text-[10px] font-bold font-sans animate-pulse uppercase tracking-wider">Listening</span>
                            <Waveform />
                          </div>
                        ) : log.status === "answered" ? (
                          `${log.duration_seconds}s`
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300 text-sm">
                        {log.intent ? (
                          <Badge variant="outline" className="border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-450 bg-amber-50/30 dark:bg-amber-500/10">
                            {log.intent}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-slate-650 dark:text-slate-400 text-sm leading-relaxed max-w-xs truncate" title={log.summary || ""}>
                        {category === "active" ? (
                          <span className="text-slate-400 dark:text-slate-500 text-xs italic font-medium">In progress...</span>
                        ) : (
                          log.summary || "No call summary recorded."
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-40 text-center text-slate-450 dark:text-slate-500 font-semibold border-b-0">
                    {campaign.status === "pending"
                      ? "This campaign has not been launched yet. Trigger launch to begin dispatching calls."
                      : "No call records resolved for this campaign execution."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

    </div>
  );
}
