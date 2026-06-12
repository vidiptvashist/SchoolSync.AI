"use client";

import React, { useState, useEffect } from "react";
import { 
  PhoneCall, 
  Users, 
  Clock, 
  Percent, 
  Calendar, 
  ChevronRight, 
  AlertCircle,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AnalyticsDashboard() {
  const [rangeType, setRangeType] = useState<"7days" | "30days" | "custom">("30days");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // SSR hydration mismatch guard for Recharts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDatesForRange = (type: "7days" | "30days" | "custom") => {
    const to = new Date();
    const from = new Date();
    if (type === "7days") {
      from.setDate(to.getDate() - 7);
    } else if (type === "30days") {
      from.setDate(to.getDate() - 30);
    } else {
      return { from: startDate, to: endDate };
    }
    return {
      from: formatLocalDate(from),
      to: formatLocalDate(to)
    };
  };

  const fetchAnalytics = async (customStart?: string, customEnd?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      let dates;
      if (rangeType === "custom") {
        dates = {
          from: customStart || startDate,
          to: customEnd || endDate
        };
      } else {
        dates = getDatesForRange(rangeType);
      }
      
      if (rangeType === "custom" && (!dates.from || !dates.to)) {
        return; // Don't fetch until user picks both dates
      }

      const res = await api.get("/analytics/overview", {
        params: {
          date_from: dates.from,
          date_to: dates.to
        }
      });
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to load analytics:", err);
      setError(err?.response?.data?.detail || "Failed to load analytics overview.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch when range changes and set up interval for auto-refresh
  useEffect(() => {
    let defaultStart = startDate;
    let defaultEnd = endDate;

    if (rangeType === "custom") {
      if (!startDate || !endDate) {
        const today = formatLocalDate(new Date());
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        defaultStart = formatLocalDate(thirtyDaysAgo);
        defaultEnd = today;
        setStartDate(defaultStart);
        setEndDate(defaultEnd);
      }
      fetchAnalytics(defaultStart, defaultEnd);
    } else {
      fetchAnalytics();
    }

    // Set up auto-refresh interval (every 5 seconds) to keep "chat live" and "chat stats" updated
    const interval = setInterval(() => {
      if (rangeType === "custom") {
        fetchAnalytics(startDate || defaultStart, endDate || defaultEnd);
      } else {
        fetchAnalytics();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [rangeType, startDate, endDate]);

  const handleCustomRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn duration-300">
      
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Monitor school call logs, intent metrics, and active campaigns</p>
        </div>
        
        {/* Date Filters Control */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex bg-slate-200/60 dark:bg-slate-950/40 rounded-xl p-1 border border-slate-200 dark:border-slate-800 shadow-inner">
            <button
              onClick={() => setRangeType("7days")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                rangeType === "7days" 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold border border-slate-200/50 dark:border-slate-800/30" 
                  : "text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Last 7 days
            </button>
            <button
              onClick={() => setRangeType("30days")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                rangeType === "30days" 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold border border-slate-200/50 dark:border-slate-800/30" 
                  : "text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Last 30 days
            </button>
            <button
              onClick={() => setRangeType("custom")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                rangeType === "custom" 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold border border-slate-200/50 dark:border-slate-800/30" 
                  : "text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Custom
            </button>
          </div>

          {rangeType === "custom" && (
            <form onSubmit={handleCustomRangeSubmit} className="flex items-center gap-2 mt-2 sm:mt-0 animate-fadeIn duration-200">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 text-xs w-36 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus-visible:ring-amber-500"
              />
              <span className="text-slate-400 text-xs font-semibold">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 text-xs w-36 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus-visible:ring-amber-500"
              />
              <Button type="submit" size="sm" className="h-10 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/10 cursor-pointer">
                Apply
              </Button>
            </form>
          )}

          {/* Sync Button */}
          <button
            onClick={() => fetchAnalytics()}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-4 py-2 text-xs font-semibold text-slate-650 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-500 dark:text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-200 rounded-2xl">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aggregating analytics...</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            
            {/* Card 1: Total Calls */}
            <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200 dark:border-slate-800/80 border-t-4 border-t-amber-500 overflow-hidden glass-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Calls</CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
                  <PhoneCall className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.total_calls}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-650 dark:text-[#22c55e]">
                  <span>+12%</span>
                  <span className="text-slate-500 dark:text-slate-500 font-medium">vs last month</span>
                </div>
              </CardContent>
            </Card>
 
            {/* Card 2: Success Rate */}
            <Card className={`hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200 dark:border-slate-800/80 border-t-4 ${data.call_success_rate >= 80 ? 'border-t-[#22c55e]' : 'border-t-rose-500'} overflow-hidden glass-panel`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Success Rate</CardTitle>
                <div className={`p-2 rounded-lg ${data.call_success_rate >= 80 ? 'bg-[#22c55e]/10 text-[#22c55e] border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                  <Percent className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-extrabold tracking-tight ${data.call_success_rate >= 80 ? 'text-emerald-650 dark:text-[#22c55e]' : 'text-rose-500'}`}>
                  {data.call_success_rate}%
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {data.call_success_rate >= 80 ? (
                    <span className="text-emerald-650 dark:text-[#22c55e] font-bold">Good (&ge;80%)</span>
                  ) : (
                    <span className="text-rose-500 font-bold">Needs Attention (&lt;80%)</span>
                  )}
                  <span>overall performance</span>
                </div>
              </CardContent>
            </Card>
 
            {/* Card 3: Average Duration */}
            <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200 dark:border-slate-800/80 border-t-4 border-t-amber-500 overflow-hidden glass-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Call Duration</CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
                  <Clock className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.average_duration_seconds}s</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Active talking time</span>
                </div>
              </CardContent>
            </Card>
 
            {/* Card 4: Unique Parents Reached */}
            <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200 dark:border-slate-800/80 border-t-4 border-t-violet-500 overflow-hidden glass-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unique Parents</CardTitle>
                <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500 border border-violet-500/20">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.unique_callers}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Distinct parent contacts</span>
                </div>
              </CardContent>
            </Card>
 
            {/* Card 5: Chat Sessions */}
            <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200 dark:border-slate-800/80 border-t-4 border-t-teal-500 overflow-hidden glass-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chat Sessions</CardTitle>
                <div className="p-2 bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <MessageSquare className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.chat_stats?.total_sessions || 0}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Active: {data.chat_stats?.active_sessions || 0} • Avg: {data.chat_stats?.avg_messages_per_session || 0} msgs</span>
                </div>
              </CardContent>
            </Card>
          </div>
 
          {/* Row 2: Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Calls Over Time Chart (Line) - 60% */}
            <Card className="lg:col-span-7 border border-slate-200 dark:border-slate-800/80 shadow-md glass-panel">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Calls Over Time</CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">Daily call log volume split by inbound and outbound direction</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px] pl-2">
                {isMounted && data.calls_by_day && data.calls_by_day.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.calls_by_day} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "var(--popover)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "12px" }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: "600", color: "var(--foreground)" }} />
                      <Line 
                        type="monotone" 
                        dataKey="inbound" 
                        name="Inbound"
                        stroke="#d97706" 
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="outbound" 
                        name="Outbound"
                        stroke="#8b5cf6" 
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-450 dark:text-slate-500">
                    No calls recorded in this date range.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Parent Questions (Bar Chart) - 40% */}
            <Card className="lg:col-span-5 glass-panel shadow-sm border border-slate-200 dark:border-slate-800/80">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Top Parent Questions</CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">Frequency of classified call intents</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px] pl-2">
                {isMounted && data.top_intents && data.top_intents.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.top_intents}
                      margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" horizontal={false} />
                      <XAxis type="number" className="text-slate-550 dark:text-slate-400" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis 
                        dataKey="label" 
                        type="category" 
                        className="text-slate-700 dark:text-slate-300" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        width={110}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "var(--color-popover)", color: "var(--color-popover-foreground)", borderRadius: "8px", border: "1px solid var(--color-border)" }}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                        {data.top_intents.map((entry: any, index: number) => {
                          const colors = ["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-450 dark:text-slate-500">
                    No classified questions in this date range.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2.5: Chat Insights & Intents */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Chat Intent Breakdown Bar Chart - 7/12 cols */}
            <Card className="lg:col-span-7 glass-panel shadow-sm border border-slate-200 dark:border-slate-800/80">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Top Chat Assistant Intents</CardTitle>
                <CardDescription className="text-xs text-slate-550 dark:text-slate-400">Frequency of parent query intents handled by the text-based chatbot</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] pl-2">
                {isMounted && data.chat_stats?.top_chat_intents && data.chat_stats.top_chat_intents.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.chat_stats.top_chat_intents}
                      margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" vertical={false} />
                      <XAxis dataKey="label" className="text-slate-555 dark:text-slate-400" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis className="text-slate-555 dark:text-slate-400" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "var(--color-popover)", color: "var(--color-popover-foreground)", borderRadius: "8px", border: "1px solid var(--color-border)" }}
                      />
                      <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={28}>
                        {data.chat_stats.top_chat_intents.map((entry: any, index: number) => {
                          const colors = ["#0d9488", "#0f766e", "#14b8a6", "#2dd4bf"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-450 dark:text-slate-500">
                    No chat messages recorded in this date range.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat Engagement Statistics Cards - 5/12 cols */}
            <Card className="lg:col-span-5 glass-panel shadow-sm border border-slate-200 dark:border-slate-800/80">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Chat Engagement Overview</CardTitle>
                <CardDescription className="text-xs text-slate-550 dark:text-slate-400">Aggregated text chat assistant metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Active Conversations</span>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {data.chat_stats?.active_sessions || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Avg Messages / Session</span>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {data.chat_stats?.avg_messages_per_session || 0}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-teal-50/50 dark:bg-teal-900/20 border border-teal-100/50 dark:border-teal-800/40 rounded-2xl space-y-2.5">
                  <div className="flex gap-2 items-center text-teal-800 dark:text-teal-400 font-bold text-xs">
                    <MessageSquare className="h-4 w-4 text-teal-600 dark:text-teal-500" />
                    <span>Parent Portal Performance</span>
                  </div>
                  <p className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed font-sans font-medium">
                    The parent chat portal allows parents to request information about fee status and attendance using secure OTP login. High average message count indicates strong parent self-service engagement.
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Row 3: Campaign Performance Table */}
          <Card className="glass-panel shadow-sm border border-slate-200 dark:border-slate-800/80">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Campaign Performance</CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">Outbound notice broadcasting campaigns run in this window</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.campaign_stats && data.campaign_stats.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-850">
                      <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider py-4 pl-6">Campaign Name</TableHead>
                        <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider text-right">Calls Sent</TableHead>
                        <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider text-right">Answered</TableHead>
                        <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider text-right">Success Rate</TableHead>
                        <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider text-right pr-6">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.campaign_stats.map((campaign: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/60 transition-colors">
                          <TableCell className="font-bold text-slate-900 dark:text-white py-3.5 pl-6">{campaign.campaign_name}</TableCell>
                          <TableCell className="text-right text-slate-700 dark:text-slate-300 font-bold font-mono text-xs">{campaign.total}</TableCell>
                          <TableCell className="text-right text-slate-700 dark:text-slate-300 font-bold font-mono text-xs">{campaign.answered}</TableCell>
                          <TableCell className="text-right py-3.5 font-bold font-mono text-xs">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              campaign.rate >= 80 
                                ? "bg-[#22c55e]/10 text-[#22c55e]" 
                                : campaign.rate >= 50 
                                ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                                : "bg-rose-550/10 text-rose-500 border border-rose-500/20"
                            }`}>
                              {campaign.rate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-slate-500 dark:text-slate-400 text-xs font-semibold pr-6">
                            {campaign.date ? campaign.date : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-32 w-full items-center justify-center text-sm font-semibold text-slate-450 dark:text-slate-500">
                  No active campaigns recorded in this date range.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
