"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  Phone,
  Calendar,
  Users,
  Shield,
  Activity,
  Edit2,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  PhoneCall
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import superAdminApi from "@/lib/super-admin-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define TypeScript interfaces for our payload
interface AdminUser {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface CallLog {
  id: string;
  caller_phone: string;
  direction: string;
  status: string;
  duration_seconds: number;
  created_at: string;
}

interface MonthlyVolume {
  month: string;
  count: number;
}

interface SchoolDetail {
  id: string;
  name: string;
  city: string | null;
  exotel_number: string | null;
  is_active: boolean;
  created_at: string;
  admins: AdminUser[];
  last_10_calls: CallLog[];
  monthly_volume: MonthlyVolume[];
}

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.id as string;

  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Edit details states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editExotel, setEditExotel] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Status toggle states
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Delete states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // SSR mismatch guard for Recharts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchSchoolDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await superAdminApi.get(`/super-admin/schools/${schoolId}`);
      setSchool(res.data);
      // Pre-populate edit states
      if (res.data) {
        setEditName(res.data.name || "");
        setEditCity(res.data.city || "");
        setEditExotel(res.data.exotel_number || "");
      }
    } catch (err: any) {
      console.error("Failed to load school details:", err);
      setError(err?.response?.data?.detail || "Failed to load school details.");
      toast.error(err?.response?.data?.detail || "Failed to fetch school details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolId) {
      fetchSchoolDetail();
    }
  }, [schoolId]);

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName) {
      toast.error("School name is required");
      return;
    }

    try {
      setEditLoading(true);
      await superAdminApi.patch(`/super-admin/schools/${schoolId}`, {
        name: editName,
        city: editCity || null,
        exotel_number: editExotel || null
      });
      toast.success("School details updated successfully");
      setIsEditOpen(false);
      fetchSchoolDetail();
    } catch (err: any) {
      console.error("Failed to update school details:", err);
      toast.error(err?.response?.data?.detail || "Failed to update school details.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!school) return;
    try {
      setStatusLoading(true);
      const newStatus = !school.is_active;
      await superAdminApi.patch(`/super-admin/schools/${schoolId}/status`, {
        is_active: newStatus
      });
      toast.success(`School has been successfully ${newStatus ? 'activated' : 'deactivated'}`);
      setIsStatusConfirmOpen(false);
      fetchSchoolDetail();
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err?.response?.data?.detail || "Failed to update school status.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDeleteSchool = async () => {
    try {
      setDeleteLoading(true);
      await superAdminApi.delete(`/super-admin/schools/${schoolId}`);
      toast.success("School soft-deleted successfully");
      setIsDeleteConfirmOpen(false);
      router.push("/super-admin/dashboard");
    } catch (err: any) {
      console.error("Failed to delete school:", err);
      toast.error(err?.response?.data?.detail || "Failed to delete school.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading && !school) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-400">Loading school profile...</p>
        </div>
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-905/10 max-w-xl mx-auto">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">School profile not found</h3>
        <p className="text-slate-400 text-sm mt-1 mb-6">{error || "The requested school record could not be resolved."}</p>
        <Link href="/super-admin/dashboard" passHref>
          <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg cursor-pointer">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Format call status badge
  const getCallStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "dialing":
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase">Dialing</Badge>;
      case "answered":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase">Answered</Badge>;
      case "missed":
        return <Badge className="bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase">Missed</Badge>;
      case "busy":
        return <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase">Busy</Badge>;
      case "failed":
        return <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase">Failed</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-300 border border-slate-500/20 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Back button and Header */}
      <div className="flex flex-col gap-4 pb-6 border-b border-slate-800">
        <Link href="/super-admin/dashboard" className="text-xs font-bold text-slate-400 hover:text-amber-500 flex items-center gap-1.5 transition-all">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">{school.name}</h1>
              <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border ${
                school.is_active 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                {school.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-4 mt-3 text-xs font-medium text-slate-400">
              {school.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {school.city}
                </span>
              )}
              {school.exotel_number ? (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  {school.exotel_number}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-600 italic">
                  <Phone className="h-3.5 w-3.5 text-slate-700" />
                  No Dedicated Number Configured
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Created: {new Date(school.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <Button
            onClick={() => setIsEditOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-amber-500/10 self-start sm:self-auto cursor-pointer"
          >
            <Edit2 className="h-4 w-4 stroke-[2.5]" />
            Edit Details
          </Button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Column (60% width - admins/logs) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Administrators Section */}
          <Card className="bg-[#1e293b] border-slate-800">
            <CardHeader className="pb-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-amber-500" />
                  Administrator Accounts
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 font-medium">Administrative users associated with this school tenant.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {school.admins && school.admins.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-900/60">
                      <TableRow className="border-b border-slate-800">
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 pl-5">Email Address</TableHead>
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 text-right">Created At</TableHead>
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 text-center pr-5 w-24">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {school.admins.map((admin) => (
                        <TableRow key={admin.id} className="hover:bg-slate-800/40 border-b border-slate-800/80 transition-colors">
                          <TableCell className="font-semibold text-white py-3.5 pl-5">{admin.email}</TableCell>
                          <TableCell className="text-right text-slate-400 text-xs font-semibold py-3.5">
                            {new Date(admin.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-center py-3.5 pr-5">
                            <Badge className={`rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase border ${
                              admin.is_active 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}>
                              {admin.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-slate-500 font-medium">
                  No administrative accounts configured for this school.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Logs Section */}
          <Card className="bg-[#1e293b] border-slate-800">
            <CardHeader className="pb-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <PhoneCall className="h-4.5 w-4.5 text-amber-500" />
                  Recent Voice Logs
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 font-medium">Audit logs of the last 10 incoming and outgoing calls.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {school.last_10_calls && school.last_10_calls.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-900/60">
                      <TableRow className="border-b border-slate-800">
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 pl-5">Caller Phone</TableHead>
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5">Direction</TableHead>
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 text-center">Duration</TableHead>
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 text-right">Timestamp</TableHead>
                        <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 text-center pr-5">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {school.last_10_calls.map((log) => (
                        <TableRow key={log.id} className="hover:bg-slate-800/40 border-b border-slate-800/80 transition-colors">
                          <TableCell className="font-semibold text-white py-3.5 pl-5 font-mono text-xs">{log.caller_phone}</TableCell>
                          <TableCell className="py-3.5 text-slate-300 text-xs font-semibold capitalize">{log.direction}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-slate-400 py-3.5">
                            {log.status.toLowerCase() === "answered" ? `${log.duration_seconds}s` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-slate-400 text-xs font-semibold py-3.5">
                            {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-center py-3.5 pr-5">
                            {getCallStatusBadge(log.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500 font-medium">
                  No call records logged for this school tenant yet.
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right Column (40% width - chart / danger zone) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Monthly Call Volume Chart */}
          <Card className="bg-[#1e293b] border-slate-800">
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-amber-500" />
                Call Volume History
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 font-medium">6-month monthly total calls breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {isMounted && school.monthly_volume && school.monthly_volume.length > 0 ? (
                <div className="w-full">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={school.monthly_volume} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} fontWeight={600} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} fontWeight={600} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px" }}
                        labelStyle={{ color: "#ffffff", fontWeight: "bold", fontSize: "11px" }}
                        itemStyle={{ color: "#f59e0b", fontSize: "11px", fontWeight: "bold" }}
                        cursor={{ fill: '#334155', opacity: 0.2 }}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-48 w-full items-center justify-center text-sm text-slate-500 font-medium">
                  Loading volume history...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-[#1e293b] border-red-500/20 text-slate-100 shadow-md">
            <CardHeader className="pb-4 border-b border-red-500/20 bg-red-500/5">
              <CardTitle className="text-md font-bold text-rose-500 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-4.5 w-4.5" />
                Danger Administration Zone
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 font-medium">Highly destructive tenant actions. Proceed with absolute caution.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              {/* Activate / Deactivate Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-lg">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                    {school.is_active ? "Deactivate Tenant Account" : "Activate Tenant Account"}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-relaxed">
                    {school.is_active 
                      ? "Temporarily disable school administration dashboards and outbound call lines."
                      : "Re-enable access and allow dashboard auth and VoIP services to resume."}
                  </p>
                </div>
                <Button
                  onClick={() => setIsStatusConfirmOpen(true)}
                  className={`text-xs font-bold px-4 h-9 tracking-wide self-start sm:self-auto cursor-pointer ${
                    school.is_active 
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white hover:border-transparent"
                      : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:border-transparent"
                  }`}
                >
                  {school.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>

              {/* Soft Delete */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-lg">
                <div>
                  <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wide">Soft Delete School</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-relaxed">
                    Deactivate school and flag its name as deleted. Historical logs are preserved, but login credentials are permanently destroyed.
                  </p>
                </div>
                <Button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white hover:border-transparent text-xs font-bold px-4 h-9 tracking-wide self-start sm:self-auto cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete School
                </Button>
              </div>

            </CardContent>
          </Card>

        </div>

      </div>

      {/* Edit School Details Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-[#1e293b] border border-slate-800 text-slate-100 w-full sm:max-w-md">
          <DialogHeader className="pb-4 border-b border-slate-800">
            <DialogTitle className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              Edit School Profile
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSchool} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">School Name *</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Delhi Public School"
                className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg font-medium"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">City</label>
              <Input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="e.g. New Delhi"
                className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exotel Dedicated Number</label>
              <Input
                value={editExotel}
                onChange={(e) => setEditExotel(e.target.value)}
                placeholder="e.g. 01141189359"
                className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                disabled={editLoading}
                onClick={() => setIsEditOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold h-9 px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editLoading}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 px-4 cursor-pointer"
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Status Change */}
      <Dialog open={isStatusConfirmOpen} onOpenChange={setIsStatusConfirmOpen}>
        <DialogContent className="bg-[#1e293b] border border-slate-800 text-slate-100 w-full max-w-md">
          <DialogHeader className="pb-4 border-b border-slate-800 space-y-2">
            <DialogTitle className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Confirm Status Change
            </DialogTitle>
          </DialogHeader>
          <div className="py-5 text-sm text-slate-300 font-medium leading-relaxed">
            Are you sure you want to {school.is_active ? "DEACTIVATE" : "ACTIVATE"} the school tenant <strong className="text-white">'{school.name}'</strong>?
            {school.is_active && (
              <p className="mt-2 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex gap-2">
                Warning: Deactivating the school immediately blocks dashboard logins and voice-agent caller routes for this tenant.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              variant="outline"
              disabled={statusLoading}
              onClick={() => setIsStatusConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              disabled={statusLoading}
              onClick={handleToggleStatus}
              className={`text-slate-950 font-bold text-xs h-9 px-4 cursor-pointer ${
                school.is_active 
                  ? "bg-rose-500 hover:bg-rose-600 text-white" 
                  : "bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              {statusLoading ? "Updating..." : school.is_active ? "Confirm Deactivation" : "Confirm Activation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Soft Delete */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="bg-[#1e293b] border border-slate-800 text-slate-100 w-full max-w-md">
          <DialogHeader className="pb-4 border-b border-slate-800 space-y-2">
            <DialogTitle className="text-md font-bold text-rose-500 uppercase tracking-wider flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-500 animate-bounce" />
              Confirm Soft Delete
            </DialogTitle>
          </DialogHeader>
          <div className="py-5 text-sm text-slate-300 font-medium leading-relaxed space-y-3">
            <p>
              Are you absolutely sure you want to soft delete <strong className="text-white">'{school.name}'</strong>?
            </p>
            <p className="text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
              This action deactivates the tenant, updates the school name to include a deleted timestamp, and disables logins permanently. This cannot be undone from the UI dashboard.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              variant="outline"
              disabled={deleteLoading}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              disabled={deleteLoading}
              onClick={handleDeleteSchool}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs h-9 px-4 cursor-pointer"
            >
              {deleteLoading ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
