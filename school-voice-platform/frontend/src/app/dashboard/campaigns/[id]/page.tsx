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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm font-medium">Loading execution logs...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-lg font-bold text-slate-800">Campaign not found</h3>
        <p className="text-slate-500 text-sm mt-1">This campaign register does not exist or has been deleted.</p>
        <Link href="/dashboard/campaigns" className="mt-4 inline-block">
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
            Back to campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const completionPct = campaign.total_calls > 0
    ? Math.round((campaign.answered_calls / campaign.total_calls) * 100)
    : 0;

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

  const getCallStatusBadge = (status: CallLog["status"]) => {
    switch (status) {
      case "dialing":
        return <Badge variant="warning">🟡 Dialing</Badge>;
      case "answered":
        return <Badge variant="success">🟢 Answered</Badge>;
      case "missed":
        return <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none">⚪ Missed</Badge>;
      case "busy":
        return <Badge variant="info">🔵 Busy</Badge>;
      case "failed":
        return <Badge variant="destructive">🔴 Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header section with back button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/campaigns" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
              ← Campaigns
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{campaign.name}</h2>
            {getCampaignStatusBadge(campaign.status)}
          </div>
          <p className="text-sm text-slate-500">
            Registered on {new Date(campaign.created_at).toLocaleString()}
          </p>
        </div>
        
        <Button
          onClick={fetchData}
          variant="outline"
          className="border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          Refresh Logs
        </Button>
      </div>

      {/* Campaign Stats Overview Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Calls */}
        <Card className="hover:shadow-xs transition-shadow">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Targets</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-3xl font-extrabold text-slate-800 font-mono">{campaign.total_calls}</p>
            <p className="text-xs text-slate-400 mt-1">Numbers resolved for broadcast</p>
          </CardContent>
        </Card>

        {/* Answered Calls */}
        <Card className="hover:shadow-xs transition-shadow">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Answered Calls</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-3xl font-extrabold text-slate-800 font-mono">{campaign.answered_calls}</p>
            <p className="text-xs text-slate-400 mt-1">Calls answered by parents</p>
          </CardContent>
        </Card>

        {/* Unanswered Calls */}
        <Card className="hover:shadow-xs transition-shadow">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unanswered / Failed</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-3xl font-extrabold text-slate-800 font-mono">
              {campaign.total_calls - campaign.answered_calls}
            </p>
            <p className="text-xs text-slate-400 mt-1">Busy, missed, or failed calls</p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="hover:shadow-xs transition-shadow">
          <CardHeader className="p-5 pb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Answer Success Rate</span>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-3xl font-extrabold text-indigo-600 font-mono">{completionPct}%</p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Logs Table */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Individual Call History</h3>
          <p className="text-sm text-slate-500">Detailed list of calls made for this campaign</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700 w-[20%]">Parent Phone</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[15%]">Call Status</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[15%] text-center">Duration</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[20%]">Intent Classified</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[30%]">Notice / Call Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50 transition-all">
                    <TableCell className="font-medium text-slate-900 font-mono">{log.caller_phone}</TableCell>
                    <TableCell>{getCallStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-center font-mono text-slate-600">
                      {log.status === "answered" ? `${log.duration_seconds}s` : "—"}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {log.intent ? (
                        <Badge variant="outline" className="border-indigo-100 text-indigo-700 bg-indigo-50/30">
                          {log.intent}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm leading-relaxed max-w-xs truncate" title={log.summary || ""}>
                      {log.summary || "No call summary recorded."}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-slate-500 font-medium">
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
