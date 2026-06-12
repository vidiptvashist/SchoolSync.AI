"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Notice {
  id: string;
  title: string;
  message: string;
  type: string;
  audio_url: string | null;
  audio_status: "pending" | "generating" | "ready" | "failed";
  created_at: string;
}

const noticeSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  type: z.enum(["general", "holiday", "ptm", "emergency", "fee"]),
});

type NoticeFormValues = z.infer<typeof noticeSchema>;

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: "",
      message: "",
      type: "general",
    },
  });

  // Fetch notices list from FastAPI
  const fetchNotices = async () => {
    try {
      const response = await api.get("/notices/");
      setNotices(response.data);
    } catch (error) {
      console.error("Failed to load notices:", error);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  // Polling logic: Poll notice status every 3 seconds if any notice has 'pending' or 'generating' audio status
  useEffect(() => {
    const hasUnfinishedAudio = notices.some(
      (n) => n.audio_status === "pending" || n.audio_status === "generating"
    );

    if (!hasUnfinishedAudio) return;

    const interval = setInterval(() => {
      fetchNotices();
    }, 3000);

    return () => clearInterval(interval);
  }, [notices]);

  const onSubmit = async (values: NoticeFormValues) => {
    setLoading(true);
    try {
      await api.post("/notices/", values);
      toast.success("Notice created! Generating voice audio in the background...");
      setOpenCreate(false);
      reset();
      fetchNotices();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Failed to create notice";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notice? This will also delete any campaigns linked to this notice.")) return;
    try {
      await api.delete(`/notices/${id}`);
      toast.success("Notice deleted successfully");
      fetchNotices();
    } catch (error) {
      toast.error("Failed to delete notice");
    }
  };

  const getStatusBadge = (status: Notice["audio_status"]) => {
    switch (status) {
      case "pending":
      case "generating":
        return <Badge variant="warning">🟡 Generating...</Badge>;
      case "ready":
        return <Badge variant="success">🟢 Ready</Badge>;
      case "failed":
        return <Badge variant="destructive">🔴 Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      general: "General",
      holiday: "Holiday",
      ptm: "PTM Meeting",
      emergency: "Emergency",
      fee: "Fee Reminder",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Notice Management</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">
            Create notices and templates to synthesize into automated parent voice notifications
          </p>
        </div>
        
        {/* Slide-over sheet for creation */}
        <Sheet open={openCreate} onOpenChange={setOpenCreate}>
          <SheetTrigger
            render={
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold transition-all duration-150 shadow-lg shadow-amber-500/10 cursor-pointer">
                Create Notice
              </Button>
            }
          />
          <SheetContent className="bg-slate-900 border-l border-slate-800 text-slate-100 p-6 flex flex-col gap-6 overflow-y-auto w-full sm:max-w-md shadow-2xl">
            <SheetHeader className="space-y-2 pb-4 border-b border-slate-800">
              <SheetTitle className="text-white font-extrabold text-lg uppercase tracking-wider">New Notice Template</SheetTitle>
              <SheetDescription className="text-slate-400 text-xs font-medium">
                Compose a notice. The message text will be converted to high-quality audio using voice AI.
              </SheetDescription>
            </SheetHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Notice Title</label>
                <Input
                  className="bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-sm h-10 rounded-lg"
                  placeholder="e.g. Diwali Holiday Announcement"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-red-400">{errors.title.message}</p>
                )}
              </div>

              {/* Type Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Notice Type</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 focus:ring-amber-500 focus:border-amber-500 text-sm h-10 rounded-lg px-3 outline-none"
                  {...register("type")}
                >
                  <option value="general">General Notification</option>
                  <option value="holiday">Holiday Announcement</option>
                  <option value="ptm">PTM Meeting Announcement</option>
                  <option value="emergency">Emergency Alert</option>
                  <option value="fee">Fee Payment Reminder</option>
                </select>
              </div>

              {/* Message Content Textarea */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Voice Message Content (TTS Text)</label>
                <Textarea
                  rows={6}
                  className="bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-sm rounded-lg"
                  placeholder="नमस्ते अभिभावक, दीपावली के पावन अवसर पर विद्यालय 12 नवंबर से 16 नवंबर तक बंद रहेगा..."
                  {...register("message")}
                />
                <span className="text-[10px] text-slate-500 font-medium block mt-1">
                  💡 Tip: For best results, write the message in clear Hindi/Hindi-English terms.
                </span>
                {errors.message && (
                  <p className="text-xs text-red-400">{errors.message.message}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenCreate(false)}
                  className="border-slate-800 text-slate-300 hover:bg-slate-950"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  {loading ? "Generating..." : "Create notice"}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Grid of Notice Cards */}
      {notices.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {notices.map((notice) => (
            <Card key={notice.id} className="glass-panel flex flex-col justify-between hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 relative overflow-hidden group">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded text-[10px]">
                    {getTypeLabel(notice.type)}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(notice.audio_status)}
                    <button
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-rose-450 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer"
                      title="Delete Notice"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <CardTitle className="text-base font-extrabold text-white line-clamp-1">
                  {notice.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Created {new Date(notice.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-sm text-slate-300 line-clamp-4 pb-4 font-medium leading-relaxed">
                {notice.message}
              </CardContent>
              
              <CardFooter className="border-t border-slate-800/80 pt-4 bg-slate-950/40 rounded-b-2xl">
                {notice.audio_url ? (
                  <div className="w-full flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 font-bold font-mono tracking-wider uppercase">WAV Mono</span>
                    <audio
                      src={`${api.defaults.baseURL || "http://localhost:8000"}${notice.audio_url}`}
                      controls
                      className="h-7 max-w-[170px] w-full accent-amber-500"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    {notice.audio_status === "failed" ? "❌ Audio Generation failed" : "⏳ Synthesizing AI voice..."}
                  </span>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[300px] border border-slate-800/80">
          <div className="rounded-full bg-slate-900/80 border border-slate-800 p-4 mb-4">
            <svg
              className="h-8 w-8 text-amber-500 animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">No notices created yet</h3>
          <p className="text-slate-400 text-sm max-w-sm mt-1 mb-4 font-medium leading-relaxed">
            Notice templates are required before you can dispatch voice broadcasting campaigns. Click the button to create your first notice!
          </p>
          <Button
            onClick={() => setOpenCreate(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            Create Notice Template
          </Button>
        </div>
      )}
      
    </div>
  );
}
