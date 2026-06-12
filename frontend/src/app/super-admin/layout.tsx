"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Shield, LayoutDashboard, LogOut, Activity, Bus, GraduationCap, Sun, Moon } from "lucide-react";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem("super_admin_token");
    if (!token && pathname !== "/super-admin/login") {
      router.push("/super-admin/login");
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
  }, [router, pathname]);

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
    localStorage.removeItem("super_admin_token");
    toast.success("Logged out successfully");
    router.push("/super-admin/login");
  };

  // Prevent hydration flicker
  if (!isMounted) {
    return null;
  }

  // If login page, render children directly without dashboard panel
  if (pathname === "/super-admin/login") {
    return <div className="min-h-screen bg-[#f1f5f9] dark:bg-[#0b0f19] text-slate-800 dark:text-[#f8fafc] font-sans antialiased relative overflow-hidden transition-colors duration-300">{children}</div>;
  }

  // If not authenticated and redirecting, show spinner
  if (!authenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19] text-[#f8fafc] relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg -z-10 opacity-20"></div>
        <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.1] -z-10 bg-amber-500"></div>
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-400">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f1f5f9] dark:bg-[#0b0f19] text-slate-800 dark:text-[#f8fafc] font-sans antialiased relative transition-colors duration-300">
      
      {/* Background visual components */}
      <div className="absolute inset-0 mesh-bg -z-10 opacity-30 pointer-events-none"></div>
      <div className="absolute -top-[10%] -left-[10%] w-[450px] h-[450px] rounded-full blur-[140px] opacity-[0.08] dark:opacity-[0.15] -z-10 bg-amber-500/80 pointer-events-none"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[400px] h-[400px] rounded-full blur-[130px] opacity-[0.05] dark:opacity-[0.1] -z-10 bg-violet-600 pointer-events-none"></div>

      {/* Sidebar - Sleek Dark/Light Glass */}
      <aside className="flex w-64 flex-col bg-white/70 dark:bg-slate-950/60 border-r border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl text-slate-800 dark:text-slate-100 shadow-2xl z-10 transition-colors duration-300">
        
        {/* Brand / Logo */}
        <div className="flex h-16 items-center px-6 border-b border-slate-200/80 dark:border-slate-800/80">
          <Link href="/super-admin/dashboard" className="text-md font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-xl text-slate-950 shadow-md shadow-amber-500/20 transform hover:scale-105 transition-all">
              <Bus className="h-4 w-4" />
            </div>
            <span className="bg-gradient-to-r from-amber-600 dark:from-amber-400 via-slate-900 dark:via-white to-amber-600 dark:to-amber-200 bg-clip-text text-transparent font-extrabold tracking-wide uppercase text-sm">
              SchoolSync<span className="text-amber-500 dark:text-amber-400">.AI</span> <span className="text-[10px] text-amber-500 border border-amber-500/30 px-1 rounded bg-amber-500/10">Admin</span>
            </span>
          </Link>
        </div>
        
        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          <Link
            href="/super-admin/dashboard"
            className={`group flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 border ${
              pathname === "/super-admin/dashboard" || pathname.startsWith("/super-admin/schools")
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 border-amber-400/20"
                : "text-slate-555 dark:text-slate-400 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Control Dashboard
          </Link>
        </nav>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Live System</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
            title="Sign out of Console"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden bg-transparent">
        
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md px-8 shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-slate-700 dark:text-slate-300 tracking-wide uppercase">System Status</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-650 dark:text-emerald-400">
              <Activity className="h-3 w-3 animate-pulse" />
              All Services Operational
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 rounded-xl transition-all cursor-pointer"
              title={themeMode === "dark" ? "Switch to Yellow White" : "Switch to Yellow Dark"}
            >
              {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-amber-500" />
              Role: <span className="text-amber-500">Super Admin</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
        
      </div>
    </div>
  );
}
