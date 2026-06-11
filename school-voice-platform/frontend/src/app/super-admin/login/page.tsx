"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shield, Lock, Mail } from "lucide-react";
import superAdminApi from "@/lib/super-admin-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SuperAdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);
      const res = await superAdminApi.post("/super-admin/auth/login", {
        email,
        password,
      });

      const { access_token } = res.data;
      localStorage.setItem("super_admin_token", access_token);
      toast.success("Successfully authenticated as Super Admin!");
      router.push("/super-admin/dashboard");
    } catch (err: any) {
      console.error("Login failed:", err);
      const errorMsg = err?.response?.data?.detail || "Authentication failed. Please verify credentials.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-md animate-fadeIn duration-300">
        
        {/* Decorative Header Icon */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-4 bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl text-amber-500 mb-3 shadow-lg shadow-amber-500/5">
            <Shield className="h-10 w-10 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase text-center">SchoolVoice Console</h1>
          <p className="text-xs text-slate-500 font-bold tracking-wider mt-1">Authorized Access Only</p>
        </div>

        <Card className="bg-[#1e293b] border-slate-800 shadow-2xl relative overflow-hidden">
          {/* Subtle top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700"></div>
          
          <CardHeader className="space-y-1.5 pt-7">
            <CardTitle className="text-lg font-bold text-slate-100 text-center uppercase tracking-wide">
              SchoolVoice Platform Admin
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 text-center font-medium">
              Provide credentials to establish a secure administrative session
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600 focus-visible:ring-amber-500 h-11 text-sm rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600 focus-visible:ring-amber-500 h-11 text-sm rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm tracking-wide rounded-lg transition-all shadow-md shadow-amber-500/10 active:scale-98"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></span>
                    Establishing Session...
                  </span>
                ) : (
                  "Authenticate Admin"
                )}
              </Button>
              
            </form>
          </CardContent>
        </Card>
        
        {/* Footer Warning */}
        <p className="text-[10px] text-center text-slate-600 font-bold tracking-wide mt-6 leading-relaxed max-w-sm mx-auto uppercase">
          Warning: Unauthorised connection attempts or attempts to bypass access logs are prohibited and monitored.
        </p>

      </div>
    </div>
  );
}
