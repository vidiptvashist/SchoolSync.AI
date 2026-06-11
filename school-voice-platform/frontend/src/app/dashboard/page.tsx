"use client";

import React, { useState, useEffect } from "react";
import { Users, PhoneCall, Radio, Percent, AlertCircle, RefreshCw } from "lucide-react";
import api from "@/lib/api";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<{
    total_students: number;
    calls_today: number;
    active_campaigns: number;
    success_rate: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardKPIs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/analytics/dashboard-kpis");
      setMetrics(res.data);
    } catch (err: any) {
      console.error("Failed to load dashboard KPIs:", err);
      setError(
        err?.response?.data?.detail || 
        "Failed to load dashboard statistics. Please ensure the backend is running and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardKPIs();
  }, []);

  const kpiCards = [
    {
      title: "Total Students",
      value: metrics ? String(metrics.total_students) : "0",
      description: "Enrolled in active directory",
      icon: Users,
      colorClass: "bg-indigo-50 text-indigo-600 border-t-indigo-500",
    },
    {
      title: "Calls Today",
      value: metrics ? String(metrics.calls_today) : "0",
      description: "Voice calls dispatched today",
      icon: PhoneCall,
      colorClass: "bg-emerald-50 text-emerald-600 border-t-emerald-500",
    },
    {
      title: "Active Campaigns",
      value: metrics ? String(metrics.active_campaigns) : "0",
      description: "Running broadcast campaigns",
      icon: Radio,
      colorClass: "bg-amber-50 text-amber-600 border-t-amber-500",
    },
    {
      title: "Success Rate",
      value: metrics ? metrics.success_rate : "0%",
      description: "Successful call completion rate",
      icon: Percent,
      colorClass: "bg-violet-50 text-violet-600 border-t-violet-500",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn duration-300">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">
            Overview of your school's voice AI activity and metrics
          </p>
        </div>
        
        {/* Refresh Action */}
        {!loading && (
          <button
            onClick={fetchDashboardKPIs}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow transition-all duration-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Data
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl animate-shake">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
          <button
            onClick={fetchDashboardKPIs}
            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg shadow transition-colors flex-shrink-0"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse flex flex-col justify-between h-[140px]"
              >
                <div className="flex justify-between items-start">
                  <div className="h-3.5 w-24 bg-slate-200 rounded"></div>
                  <div className="h-9 w-9 bg-slate-100 rounded-xl"></div>
                </div>
                <div>
                  <div className="h-8 w-16 bg-slate-200 rounded"></div>
                  <div className="h-3 w-32 bg-slate-100 rounded mt-2"></div>
                </div>
              </div>
            ))
          : kpiCards.map((kpi) => {
              const IconComponent = kpi.icon;
              return (
                <div
                  key={kpi.title}
                  className={`bg-white p-6 rounded-2xl border border-slate-200 border-t-4 ${kpi.colorClass} shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md cursor-default flex flex-col justify-between h-[140px]`}
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {kpi.title}
                    </p>
                    <div className={`p-2 rounded-xl`}>
                      <IconComponent className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold text-slate-800 tracking-tight">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      {kpi.description}
                    </p>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Welcome Card Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[300px] text-center transition-all duration-300 hover:shadow-md">
        <div className="rounded-full bg-slate-100 p-4 mb-3">
          <svg
            className="h-6 w-6 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800">Welcome to School Voice AI</h3>
        <p className="text-slate-500 max-w-sm text-sm mt-1">
          Upload student rosters, create notice templates, and deploy call campaigns. Go to the "Students" tab to start importing contacts!
        </p>
      </div>
      
    </div>
  );
}

