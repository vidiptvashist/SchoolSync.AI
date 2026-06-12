"use client";

import React, { useState, useEffect } from "react";
import { Users, PhoneCall, Radio, Percent, AlertCircle, RefreshCw, GraduationCap } from "lucide-react";
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
      colorClass: "hover:border-amber-500/30 text-amber-400 border-t-amber-500/60 bg-amber-500/5",
    },
    {
      title: "Calls Today",
      value: metrics ? String(metrics.calls_today) : "0",
      description: "Voice calls dispatched today",
      icon: PhoneCall,
      colorClass: "hover:border-emerald-500/30 text-emerald-400 border-t-emerald-500/60 bg-emerald-500/5",
    },
    {
      title: "Active Campaigns",
      value: metrics ? String(metrics.active_campaigns) : "0",
      description: "Running broadcast campaigns",
      icon: Radio,
      colorClass: "hover:border-amber-500/30 text-amber-400 border-t-amber-500/60 bg-amber-500/5",
    },
    {
      title: "Success Rate",
      value: metrics ? metrics.success_rate : "0%",
      description: "Successful call completion rate",
      icon: Percent,
      colorClass: "hover:border-violet-500/30 text-violet-400 border-t-violet-500/60 bg-violet-500/5",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn duration-300">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard Overview</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Real-time statistics of your school's voice communication campaign operations
          </p>
        </div>
        
        {/* Refresh Action */}
        {!loading && (
          <button
            onClick={fetchDashboardKPIs}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700 rounded-xl shadow-md transition-all duration-200 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            Sync Data
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-650 dark:text-rose-200 rounded-2xl animate-shake">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
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
                className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-2xl shadow-lg animate-pulse flex flex-col justify-between h-[140px]"
              >
                <div className="flex justify-between items-start">
                  <div className="h-3.5 w-24 bg-slate-300 dark:bg-slate-800 rounded"></div>
                  <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                </div>
                <div>
                  <div className="h-8 w-16 bg-slate-300 dark:bg-slate-800 rounded"></div>
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800/60 rounded mt-2"></div>
                </div>
              </div>
            ))
          : kpiCards.map((kpi) => {
              const IconComponent = kpi.icon;
              return (
                <div
                  key={kpi.title}
                  className={`glass-panel p-6 rounded-2xl border-t-4 ${kpi.colorClass} shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg cursor-default flex flex-col justify-between h-[140px]`}
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {kpi.title}
                    </p>
                    <div className="p-2 bg-slate-100 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/50">
                      <IconComponent className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {kpi.description}
                    </p>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Welcome Card Info */}
      <div className="glass-panel rounded-3xl p-8 shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center transition-all duration-300 relative overflow-hidden group hover:border-amber-500/20">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 opacity-60"></div>
        <div className="rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 mb-4 shadow-sm">
          <GraduationCap className="h-6 w-6 text-amber-500 dark:text-amber-400 animate-pulse" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Welcome to SchoolSync.AI</h3>
        <p className="text-slate-650 dark:text-slate-400 max-w-md text-sm mt-2 font-medium leading-relaxed">
          Upload student rosters, create notice templates, and deploy call campaigns. Go to the "Students" tab to start importing contacts!
        </p>
      </div>
      
    </div>
  );
}

