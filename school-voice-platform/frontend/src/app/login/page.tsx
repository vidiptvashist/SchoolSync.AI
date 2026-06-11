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
    <div className="flex min-h-screen flex-col justify-center bg-slate-900 px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
          School Voice AI
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to manage your school's voice portal
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800 px-8 py-8 shadow-2xl rounded-2xl border border-slate-700">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                Email address
              </label>
              <div className="mt-2">
                <Input
                  id="email"
                  type="email"
                  className="bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="admin@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                Password
              </label>
              <div className="mt-2">
                <Input
                  id="password"
                  type="password"
                  className="bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-md"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
