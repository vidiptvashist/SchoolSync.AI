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
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] px-4 relative overflow-hidden font-sans">
      {/* Sleek dark-mesh grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] -z-10 opacity-20"></div>
      
      {/* Dynamic ambient color glowing blobs in amber */}
      <div className="absolute -top-[15%] -left-[5%] w-[380px] h-[380px] rounded-full blur-[130px] opacity-[0.12] -z-10 bg-amber-500"></div>
      <div className="absolute -bottom-[15%] -right-[5%] w-[320px] h-[320px] rounded-full blur-[110px] opacity-[0.1] -z-10 bg-amber-600"></div>

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Decorative Header Icon */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-500 mb-3 shadow-lg shadow-amber-500/5 animate-pulse">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white uppercase text-center bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">
            SchoolSync Console
          </h1>
          <p className="text-[10px] text-slate-500 font-extrabold tracking-widest mt-1 uppercase">Authorized Access Only</p>
        </div>

        <Card className="bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-[0_30px_70px_rgba(0,0,0,0.5)] rounded-3xl relative overflow-hidden">
          {/* Subtle top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700"></div>
          
          <CardHeader className="space-y-1.5 pt-7">
            <CardTitle className="text-md font-bold text-slate-100 text-center uppercase tracking-wider">
              SchoolSync.AI Platform Admin
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 text-center font-medium">
              Provide credentials to establish a secure administrative session
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 bg-slate-950 border-slate-800/80 text-slate-100 placeholder-slate-650 focus-visible:ring-amber-500/30 focus-visible:border-amber-500 h-11 text-sm rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 bg-slate-950 border-slate-800/80 text-slate-100 placeholder-slate-650 focus-visible:ring-amber-500/30 focus-visible:border-amber-500 h-11 text-sm rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-98 disabled:opacity-50 cursor-pointer border-none"
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
        <p className="text-[9px] text-center text-slate-600 font-bold tracking-widest mt-6 leading-relaxed max-w-xs mx-auto uppercase">
          Warning: Unauthorised connection attempts or attempts to bypass access logs are prohibited and monitored.
        </p>

      </div>
    </div>
  );
}
