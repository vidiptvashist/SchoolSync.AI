"use client";

import React, { useState, useEffect } from "react";
import { 
  PhoneCall, 
  Users, 
  Clock, 
  Percent, 
  Calendar, 
  ChevronRight, 
  AlertCircle 
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
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0]
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

  // Fetch when range changes
  useEffect(() => {
    if (rangeType !== "custom") {
      fetchAnalytics();
    } else {
      // Set default inputs for custom range (last 30 days)
      let defaultStart = startDate;
      let defaultEnd = endDate;
      if (!startDate || !endDate) {
        const today = new Date().toISOString().split("T")[0];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        defaultStart = thirtyDaysAgo.toISOString().split("T")[0];
        defaultEnd = today;
        setStartDate(defaultStart);
        setEndDate(defaultEnd);
      }
      fetchAnalytics(defaultStart, defaultEnd);
    }
  }, [rangeType]);

  const handleCustomRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Monitor school call logs, intent metrics, and active campaigns</p>
        </div>
        
        {/* Date Filters Control */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-sm">
            <button
              onClick={() => setRangeType("7days")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                rangeType === "7days" 
                  ? "bg-white text-indigo-700 shadow-sm font-bold" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Last 7 days
            </button>
            <button
              onClick={() => setRangeType("30days")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                rangeType === "30days" 
                  ? "bg-white text-indigo-700 shadow-sm font-bold" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Last 30 days
            </button>
            <button
              onClick={() => setRangeType("custom")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                rangeType === "custom" 
                  ? "bg-white text-indigo-700 shadow-sm font-bold" 
                  : "text-slate-600 hover:text-slate-900"
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
                className="h-10 text-xs w-36 border-slate-300 bg-white"
              />
              <span className="text-slate-400 text-xs font-semibold">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 text-xs w-36 border-slate-300 bg-white"
              />
              <Button type="submit" size="sm" className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs text-white">
                Apply
              </Button>
            </form>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500">Aggregating analytics...</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* Card 1: Total Calls */}
            <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 border-t-4 border-t-[#6366f1] overflow-hidden bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Calls</CardTitle>
                <div className="p-2 bg-[#6366f1]/10 rounded-lg text-[#6366f1]">
                  <PhoneCall className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.total_calls}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-[#22c55e]">
                  <span>+12%</span>
                  <span className="text-slate-400 font-medium">vs last month</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Success Rate */}
            <Card className={`hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 border-t-4 ${data.call_success_rate >= 80 ? 'border-t-[#22c55e]' : 'border-t-rose-500'} overflow-hidden bg-white`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Success Rate</CardTitle>
                <div className={`p-2 rounded-lg ${data.call_success_rate >= 80 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-rose-50 text-rose-600'}`}>
                  <Percent className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-extrabold tracking-tight ${data.call_success_rate >= 80 ? 'text-[#22c55e]' : 'text-rose-600'}`}>
                  {data.call_success_rate}%
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 font-medium">
                  {data.call_success_rate >= 80 ? (
                    <span className="text-[#22c55e] font-bold">Good (&ge;80%)</span>
                  ) : (
                    <span className="text-rose-600 font-bold">Needs Attention (&lt;80%)</span>
                  )}
                  <span>overall performance</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Average Duration */}
            <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 border-t-4 border-t-[#f59e0b] overflow-hidden bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Call Duration</CardTitle>
                <div className="p-2 bg-[#f59e0b]/10 rounded-lg text-[#f59e0b]">
                  <Clock className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.average_duration_seconds}s</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 font-medium">
                  <span>Active talking time</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Unique Parents Reached */}
            <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 border-t-4 border-t-[#8b5cf6] overflow-hidden bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unique Parents</CardTitle>
                <div className="p-2 bg-[#8b5cf6]/10 rounded-lg text-[#8b5cf6]">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.unique_callers}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 font-medium">
                  <span>Distinct parent contacts</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Calls Over Time Chart (Line) - 60% */}
            <Card className="lg:col-span-7 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800">Calls Over Time</CardTitle>
                <CardDescription className="text-xs">Daily call log volume split by inbound and outbound direction</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px] pl-2">
                {isMounted && data.calls_by_day && data.calls_by_day.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.calls_by_day} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
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
                        contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: "8px", border: "none" }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: "600" }} />
                      <Line 
                        type="monotone" 
                        dataKey="inbound" 
                        name="Inbound"
                        stroke="#6366f1" 
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
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                    No calls recorded in this date range.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Parent Questions (Bar Chart) - 40% */}
            <Card className="lg:col-span-5 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800">Top Parent Questions</CardTitle>
                <CardDescription className="text-xs">Frequency of classified call intents</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px] pl-2">
                {isMounted && data.top_intents && data.top_intents.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.top_intents}
                      margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis 
                        dataKey="label" 
                        type="category" 
                        stroke="#475569" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        width={110}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: "8px", border: "none" }}
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
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                    No classified questions in this date range.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Campaign Performance Table */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Campaign Performance</CardTitle>
                <CardDescription className="text-xs">Outbound notice broadcasting campaigns run in this window</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {data.campaign_stats && data.campaign_stats.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="text-slate-700 font-bold text-xs uppercase tracking-wider py-4">Campaign Name</TableHead>
                        <TableHead className="text-slate-700 font-bold text-xs uppercase tracking-wider text-right">Calls Sent</TableHead>
                        <TableHead className="text-slate-700 font-bold text-xs uppercase tracking-wider text-right">Answered</TableHead>
                        <TableHead className="text-slate-700 font-bold text-xs uppercase tracking-wider text-right">Success Rate</TableHead>
                        <TableHead className="text-slate-700 font-bold text-xs uppercase tracking-wider text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.campaign_stats.map((campaign: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors">
                          <TableCell className="font-semibold text-slate-900 py-3.5">{campaign.campaign_name}</TableCell>
                          <TableCell className="text-right text-slate-700 font-medium">{campaign.total}</TableCell>
                          <TableCell className="text-right text-slate-700 font-medium">{campaign.answered}</TableCell>
                          <TableCell className="text-right py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              campaign.rate >= 80 
                                ? "bg-[#22c55e]/10 text-[#22c55e]" 
                                : campaign.rate >= 50 
                                ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                                : "bg-rose-50 text-rose-700"
                            }`}>
                              {campaign.rate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-slate-500 text-xs font-semibold">
                            {campaign.date ? campaign.date : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-32 w-full items-center justify-center border border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-400">
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
