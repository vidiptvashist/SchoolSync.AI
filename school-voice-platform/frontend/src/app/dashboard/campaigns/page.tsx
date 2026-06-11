"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Notice {
  id: string;
  title: string;
  audio_status: string;
}

interface Campaign {
  id: string;
  name: string;
  notice_id: string;
  target_type: string;
  target_filter: {
    class_name?: string;
    section?: string;
    resolved_phones?: string[];
  };
  status: "pending" | "running" | "completed" | "failed";
  total_calls: number;
  answered_calls: number;
  scheduled_at: string | null;
  created_at: string;
}

const campaignSchema = z.object({
  name: z.string().min(3, "Campaign name must be at least 3 characters"),
  notice_id: z.string().uuid("Please select a valid notice"),
  target_type: z.enum(["all", "class", "section"]),
  class_name: z.string().optional(),
  section: z.string().optional(),
  schedule_type: z.enum(["now", "later"]),
  scheduled_at: z.string().optional(),
}).refine((data) => {
  if (data.target_type === "class" && !data.class_name) {
    return false;
  }
  if (data.target_type === "section" && (!data.class_name || !data.section)) {
    return false;
  }
  if (data.schedule_type === "later" && !data.scheduled_at) {
    return false;
  }
  return true;
}, {
  message: "Please fill in all target details and scheduling date",
  path: ["target_type"],
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [readyNotices, setReadyNotices] = useState<Notice[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      notice_id: "",
      target_type: "all",
      class_name: "",
      section: "",
      schedule_type: "now",
      scheduled_at: "",
    },
  });

  const watchTargetType = watch("target_type");
  const watchScheduleType = watch("schedule_type");

  const fetchCampaigns = async () => {
    try {
      const response = await api.get("/campaigns/");
      setCampaigns(response.data);
    } catch (error) {
      console.error("Failed to load campaigns:", error);
    }
  };

  const fetchReadyNotices = async () => {
    try {
      const response = await api.get("/notices/");
      // Only keep notices where audio_status is ready
      const ready = response.data.filter((n: Notice) => n.audio_status === "ready");
      setReadyNotices(ready);
    } catch (error) {
      console.error("Failed to load notices:", error);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchReadyNotices();
  }, []);

  // Polling logic: Poll campaign list every 2 seconds if any campaign is in "running" status
  useEffect(() => {
    const hasRunningCampaign = campaigns.some((c) => c.status === "running");
    if (!hasRunningCampaign) return;

    const interval = setInterval(() => {
      fetchCampaigns();
    }, 2000);

    return () => clearInterval(interval);
  }, [campaigns]);

  const onSubmit = async (values: CampaignFormValues) => {
    setLoading(true);
    try {
      // Structure target_filter
      const target_filter: Record<string, string> = {};
      if (values.target_type === "class" || values.target_type === "section") {
        target_filter["class_name"] = values.class_name || "";
      }
      if (values.target_type === "section") {
        target_filter["section"] = values.section || "";
      }

      const payload = {
        name: values.name,
        notice_id: values.notice_id,
        target_type: values.target_type,
        target_filter,
        scheduled_at: values.schedule_type === "later" ? values.scheduled_at : null,
      };

      await api.post("/campaigns/", payload);
      toast.success("Campaign created successfully!");
      setOpenCreate(false);
      reset();
      fetchCampaigns();
    } catch (error: any) {
      const detail = error.response?.data?.detail || "Failed to create campaign";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Stop row click navigation
    setLaunchingId(id);
    try {
      await api.post(`/campaigns/${id}/launch`);
      toast.success("Campaign dispatched! Calling Exotel API...");
      fetchCampaigns();
    } catch (error: any) {
      const detail = error.response?.data?.detail || "Failed to dispatch campaign";
      toast.error(detail);
    } finally {
      setLaunchingId(null);
    }
  };

  const handleDeleteCampaign = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this campaign? All call logs associated with it will lose their campaign link, but call histories are preserved.")) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success("Campaign deleted successfully");
      fetchCampaigns();
    } catch (error) {
      toast.error("Failed to delete campaign");
    }
  };

  const getStatusBadge = (status: Campaign["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning">🟡 Pending</Badge>;
      case "running":
        return <Badge variant="info">🔵 Running</Badge>;
      case "completed":
        return <Badge variant="success">🟢 Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">🔴 Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Calling Campaigns</h2>
          <p className="text-sm text-slate-500">
            Launch or schedule voice notices to parental phone registers
          </p>
        </div>
        <Button
          onClick={() => {
            fetchReadyNotices();
            setOpenCreate(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all duration-150 shadow-sm"
        >
          New Campaign
        </Button>
      </div>

      {/* Campaigns Listing Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-700">Campaign Name</th>
                <th className="p-4 font-semibold text-slate-700">Status</th>
                <th className="p-4 font-semibold text-slate-700 text-center">Total Calls</th>
                <th className="p-4 font-semibold text-slate-700 text-center">Answered</th>
                <th className="p-4 font-semibold text-slate-700">Completion %</th>
                <th className="p-4 font-semibold text-slate-700">Schedule / Run Date</th>
                <th className="p-4 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length > 0 ? (
                campaigns.map((c) => {
                  const pct = c.total_calls > 0 ? Math.round((c.answered_calls / c.total_calls) * 100) : 0;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-all cursor-pointer"
                    >
                      <td className="p-4 font-medium text-slate-900">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="block">
                          {c.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="block">
                          {getStatusBadge(c.status)}
                        </Link>
                      </td>
                      <td className="p-4 text-center text-slate-600">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="block font-mono">
                          {c.total_calls}
                        </Link>
                      </td>
                      <td className="p-4 text-center text-slate-600">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="block font-mono">
                          {c.answered_calls}
                        </Link>
                      </td>
                      <td className="p-4 w-[15%]">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="block space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-indigo-600">
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Link>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="block">
                          {c.scheduled_at
                            ? `Scheduled: ${new Date(c.scheduled_at).toLocaleString()}`
                            : `Dispatched: ${new Date(c.created_at).toLocaleString()}`}
                        </Link>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === "pending" && (
                            <Button
                              size="sm"
                              disabled={launchingId === c.id}
                              onClick={(e) => handleLaunch(e, c.id)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                            >
                              {launchingId === c.id ? "Launching..." : "Launch Now"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteCampaign(e, c.id)}
                            className="text-red-600 hover:text-red-900 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="h-44 text-center text-slate-500 font-medium bg-white">
                    No campaigns registered. Click "New Campaign" to launch a broadcast.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal - ShadCN Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-lg bg-white border border-slate-200 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-slate-800 font-bold">Initiate Voice Campaign</DialogTitle>
              <DialogDescription className="text-slate-500">
                Choose a ready notice voice note and select target parent filters.
              </DialogDescription>
            </DialogHeader>

            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Campaign Name</label>
              <Input
                className="bg-white border-slate-200 text-slate-800"
                placeholder="e.g. 5th Grade PTM Announcement"
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            {/* Notice selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Voice Notice</label>
              <Select {...register("notice_id")}>
                <option value="">-- Choose Notice Template --</option>
                {readyNotices.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </Select>
              {readyNotices.length === 0 && (
                <p className="text-xs text-amber-600 font-medium">
                  ⚠️ Note: Only notices with 'Ready' voice statuses are displayed. Make sure your notice audio is processed first!
                </p>
              )}
              {errors.notice_id && <p className="text-xs text-red-500">{errors.notice_id.message}</p>}
            </div>

            {/* Target selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Target Group</label>
                <Select {...register("target_type")}>
                  <option value="all">All Parents</option>
                  <option value="class">Specific Class</option>
                  <option value="section">Specific Section</option>
                </Select>
              </div>

              {/* Class Selection */}
              {(watchTargetType === "class" || watchTargetType === "section") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Class Name</label>
                  <Input
                    className="bg-white border-slate-200 text-slate-800"
                    placeholder="e.g. 10 or 5"
                    {...register("class_name")}
                  />
                </div>
              )}
            </div>

            {/* Section Selection */}
            {watchTargetType === "section" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Section</label>
                <Input
                  className="bg-white border-slate-200 text-slate-800"
                  placeholder="e.g. A or B"
                  {...register("section")}
                />
              </div>
            )}

            {/* Schedule type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Schedule Run</label>
                <Select {...register("schedule_type")}>
                  <option value="now">Send Immediately</option>
                  <option value="later">Schedule for Later</option>
                </Select>
              </div>

              {watchScheduleType === "later" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 text-slate-800"
                    {...register("scheduled_at")}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenCreate(false);
                  reset();
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-all duration-150"
              >
                {loading ? "Registering..." : "Submit Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
