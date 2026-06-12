"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Bell, 
  PhoneCall, 
  Database, 
  BarChart3, 
  Settings, 
  LogOut, 
  Radio, 
  GraduationCap, 
  Bus,
  Sun,
  Moon
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Client-side authentication guard check
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      setAuthenticated(true);
    }

    // Initialize theme mode
    const savedTheme = localStorage.getItem("theme_mode") as "light" | "dark" | null;
    if (savedTheme === "light") {
      setThemeMode("light");
      document.documentElement.classList.remove("dark");
    } else {
      setThemeMode("dark");
      document.documentElement.classList.add("dark");
    }
  }, [router]);

  const toggleTheme = () => {
    if (themeMode === "dark") {
      setThemeMode("light");
      localStorage.setItem("theme_mode", "light");
      document.documentElement.classList.remove("dark");
      toast.info("Day Mode");
    } else {
      setThemeMode("dark");
      localStorage.setItem("theme_mode", "dark");
      document.documentElement.classList.add("dark");
      toast.info("Night Mode");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("school_id");
    localStorage.removeItem("role");
    toast.success("Successfully logged out!");
    router.push("/login");
  };

  // Render a loading state during session verification to prevent layout flashing
  if (!authenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19] text-white relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg -z-10 opacity-20"></div>
        <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.1] -z-10 bg-amber-500"></div>
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-400">Syncing Secure Session...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Students", href: "/dashboard/students", icon: Users },
    { name: "Notices", href: "/dashboard/notices", icon: Bell },
    { name: "Campaigns", href: "/dashboard/campaigns", icon: Radio },
    { name: "Call Logs", href: "/dashboard/calls", icon: PhoneCall },
    { name: "Knowledge Base", href: "/dashboard/knowledge-base", icon: Database },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f1f5f9] dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 font-sans relative transition-colors duration-300">
      
      {/* Background visual components */}
      <div className="absolute inset-0 mesh-bg -z-10 opacity-30 pointer-events-none"></div>
      <div className="absolute -top-[10%] -left-[10%] w-[450px] h-[450px] rounded-full blur-[140px] opacity-[0.08] dark:opacity-[0.15] -z-10 bg-amber-500/80 pointer-events-none"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[400px] h-[400px] rounded-full blur-[130px] opacity-[0.05] dark:opacity-[0.1] -z-10 bg-violet-600 pointer-events-none"></div>

      {/* Sidebar Panel - Dark/Light Glass */}
      <aside className="flex w-64 flex-col bg-white/70 dark:bg-slate-950/60 border-r border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl text-slate-800 dark:text-white shadow-2xl z-10 transition-colors duration-300">
        
        {/* Brand/Logo Section */}
        <div className="flex h-16 items-center px-6 border-b border-slate-200/80 dark:border-slate-800/80">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-xl text-slate-950 shadow-md shadow-amber-500/20 transform hover:scale-105 transition-all">
              <Bus className="h-4 w-4" />
            </div>
            <span className="bg-gradient-to-r from-amber-600 dark:from-amber-400 via-slate-900 dark:via-white to-amber-600 dark:to-amber-200 bg-clip-text text-transparent font-extrabold tracking-wide uppercase text-sm">
              SchoolSync<span className="text-amber-500 dark:text-amber-400">.AI</span>
            </span>
          </Link>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 border ${
                  isActive
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 border-amber-400/20"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-350 dark:hover:border-slate-800 border-transparent"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 duration-200 ${isActive ? "text-slate-950" : "text-slate-500 dark:text-slate-400 group-hover:text-amber-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/85 dark:border-slate-800/80 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Enterprise Console</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-650 font-bold tracking-widest uppercase">v1.0.0 Stable</p>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-transparent">
        
        {/* Top Header - Glassmorphic */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md px-8 z-10 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-sm">
              <GraduationCap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">Test Academy</span>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-650 dark:text-emerald-400 tracking-wider uppercase">
              Operational
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 rounded-xl transition-all cursor-pointer"
              title={themeMode === "dark" ? "Switch to Yellow White" : "Switch to Yellow Dark"}
            >
              {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-450 hover:bg-rose-500/10 hover:border-rose-500/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
        
      </div>
    </div>
  );
}
