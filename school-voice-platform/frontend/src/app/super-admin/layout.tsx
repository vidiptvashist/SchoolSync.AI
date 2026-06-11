"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Shield, LayoutDashboard, LogOut, Activity } from "lucide-react";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem("super_admin_token");
    if (!token && pathname !== "/super-admin/login") {
      router.push("/super-admin/login");
    } else {
      setAuthenticated(true);
    }
  }, [router, pathname]);

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
    return <div className="min-h-screen bg-[#0f172a] text-[#f8fafc] font-sans antialiased">{children}</div>;
  }

  // If not authenticated and redirecting, show spinner
  if (!authenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0f172a] text-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-400">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f172a] text-[#f8fafc] font-sans antialiased">
      {/* Sidebar - Sleek Dark #0b0f19 */}
      <aside className="flex w-64 flex-col bg-[#0b0f19] border-r border-slate-800 text-slate-100 shadow-2xl z-10">
        
        {/* Brand / Logo */}
        <div className="flex h-16 items-center px-6 border-b border-slate-800">
          <Link href="/super-admin/dashboard" className="text-md font-bold tracking-tight text-white flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-500">
              <Shield className="h-4 w-4" />
            </div>
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">SchoolVoice Admin</span>
          </Link>
        </div>
        
        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          <Link
            href="/super-admin/dashboard"
            className={`group flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
              pathname === "/super-admin/dashboard" || pathname.startsWith("/super-admin/schools")
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Control Dashboard
          </Link>
        </nav>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Live System</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all border border-transparent hover:border-rose-500/20"
            title="Sign out of Console"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#0f172a]">
        
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-[#0b0f19] px-8 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-slate-300 tracking-wide uppercase">System Status</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              <Activity className="h-3 w-3 animate-pulse" />
              All Services Operational
            </span>
          </div>

          <div className="text-xs font-bold text-slate-400 bg-slate-800/40 border border-slate-800 px-3 py-1.5 rounded-lg">
            Role: <span className="text-amber-500">Super Admin</span>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
        
      </div>
    </div>
  );
}
