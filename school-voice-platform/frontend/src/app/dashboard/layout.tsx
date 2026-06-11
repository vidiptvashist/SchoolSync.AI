"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Client-side authentication guard check
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      setAuthenticated(true);
    }
  }, [router]);

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
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Students", href: "/dashboard/students" },
    { name: "Notices", href: "/dashboard/notices" },
    { name: "Campaigns", href: "/dashboard/campaigns" },
    { name: "Call Logs", href: "/dashboard/calls" },
    { name: "Knowledge Base", href: "/dashboard/knowledge-base" },
    { name: "Analytics", href: "/dashboard/analytics" },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      
      {/* Sidebar Panel - slate-800 (#1e293b) */}
      <aside className="flex w-64 flex-col bg-slate-800 text-white shadow-2xl z-10">
        
        {/* Brand/Logo Section */}
        <div className="flex h-16 items-center px-6 border-b border-slate-700">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Voice AI Panel
          </Link>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-700">
          <p className="text-xs text-slate-400 text-center font-medium">v0.1.0 (Developer Beta)</p>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        
        {/* Top Header - White Background */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-800">Test Academy</h1>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              Active School
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150"
            >
              Sign out
            </Button>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
          {children}
        </main>
        
      </div>
    </div>
  );
}
