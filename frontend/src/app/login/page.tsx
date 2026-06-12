"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Zod schema for input validation
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const response = await api.post("/auth/login", values);
      const { access_token, school_id, role } = response.data;

      // Save tokens and metadata locally
      localStorage.setItem("token", access_token);
      localStorage.setItem("school_id", school_id);
      localStorage.setItem("role", role);

      toast.success("Successfully logged in!");
      
      // Redirect to the dashboard layout
      router.push("/dashboard");
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Invalid email or password";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#0b0f19] px-6 py-12 lg:px-8 relative overflow-hidden font-sans">
      {/* Sleek dark-mesh grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] -z-10 opacity-20"></div>
      
      {/* Dynamic ambient color glowing blobs */}
      <div className="absolute -top-[20%] -left-[10%] w-[400px] h-[400px] rounded-full blur-[130px] opacity-[0.2] -z-10 bg-indigo-600"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[350px] h-[350px] rounded-full blur-[110px] opacity-[0.15] -z-10 bg-violet-600"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center animate-in fade-in slide-in-from-top-4 duration-300">
        <h2 className="text-4xl font-extrabold tracking-tight text-white bg-gradient-to-r from-indigo-200 via-white to-violet-200 bg-clip-text text-transparent">
          SchoolSync.AI
        </h2>
        <p className="mt-3 text-sm text-slate-400 font-medium tracking-wide">
          School & Parent Communication Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in zoom-in duration-300 delay-100">
        <div className="bg-slate-900/60 backdrop-blur-lg px-8 py-8 shadow-[0_30px_70px_rgba(0,0,0,0.5)] rounded-3xl border border-slate-800/80 relative overflow-hidden">
          {/* Subtle top brand colored bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600"></div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                Email Address
              </label>
              <div className="mt-1">
                <Input
                  id="email"
                  type="email"
                  className="bg-slate-950 border-slate-800/80 text-white placeholder-slate-600 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 text-sm h-11 rounded-xl font-medium"
                  placeholder="admin@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                Password
              </label>
              <div className="mt-1">
                <Input
                  id="password"
                  type="password"
                  className="bg-slate-950 border-slate-800/80 text-white placeholder-slate-600 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 text-sm h-11 rounded-xl font-medium"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm tracking-wide rounded-xl transition-all shadow-lg shadow-indigo-600/10 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Signing in..." : "Authenticate Session"}
              </Button>
            </div>

          </form>
        </div>
      </div>
      
      {/* Brand Footer */}
      <p className="text-[10px] text-center text-slate-600 font-bold tracking-wider mt-8 uppercase">
        © 2026 SchoolSync.AI • All Rights Reserved
      </p>
    </div>
  );
}
