"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Building2, 
  PhoneCall, 
  Users, 
  CheckCircle, 
  Plus, 
  MapPin, 
  Phone, 
  Calendar,
  MoreVertical,
  Activity,
  Copy,
  Check,
  AlertTriangle,
  UserCheck
} from "lucide-react";
import superAdminApi from "@/lib/super-admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SuperAdminDashboard() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sheet state for Add School
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newSchoolPhone, setNewSchoolPhone] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Modal state for showing generated credentials
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Dialog state for confirm deactivation/activation
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmSchool, setConfirmSchool] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      const res = await superAdminApi.get("/super-admin/schools");
      setSchools(res.data);
    } catch (err: any) {
      console.error("Failed to load schools:", err);
      toast.error(err?.response?.data?.detail || "Failed to fetch schools list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  // Calculate platform statistics locally
  const totalSchools = schools.length;
  const activeSchools = schools.filter(s => s.is_active).length;
  const totalCallsMonth = schools.reduce((acc, s) => acc + (s.stats?.calls_this_month || 0), 0);
  const totalStudents = schools.reduce((acc, s) => acc + (s.stats?.total_students || 0), 0);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName || !newAdminEmail) {
      toast.error("School Name and Admin Email are required.");
      return;
    }

    try {
      setCreateLoading(true);
      const res = await superAdminApi.post("/super-admin/schools", {
        school_name: newSchoolName,
        city: newCity || null,
        school_phone: newSchoolPhone || null,
        admin_email: newAdminEmail,
        admin_name: newAdminName || null
      });

      // Clear input fields
      setNewSchoolName("");
      setNewCity("");
      setNewSchoolPhone("");
      setNewAdminEmail("");
      setNewAdminName("");
      setIsSheetOpen(false);

      // Show credentials modal
      setCreatedCredentials(res.data);
      setIsCredentialsModalOpen(true);
      toast.success("School and Admin user registered successfully!");
      
      // Refresh schools list
      fetchSchools();
    } catch (err: any) {
      console.error("Failed to create school:", err);
      toast.error(err?.response?.data?.detail || "Failed to create school.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const shareText = `Login URL: app.schoolvoice.in/login\nEmail: ${createdCredentials.admin_user.email}\nPassword: ${createdCredentials.generated_password}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success("Credentials copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const openStatusConfirm = (school: any) => {
    setConfirmSchool(school);
    setIsConfirmOpen(true);
  };

  const handleToggleStatus = async () => {
    if (!confirmSchool) return;
    
    try {
      setStatusLoading(true);
      const newStatus = !confirmSchool.is_active;
      const res = await superAdminApi.patch(`/super-admin/schools/${confirmSchool.id}/status`, {
        is_active: newStatus
      });

      toast.success(`School '${confirmSchool.name}' has been successfully ${newStatus ? 'activated' : 'deactivated'}.`);
      setIsConfirmOpen(false);
      setConfirmSchool(null);
      
      // Refresh list
      fetchSchools();
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err?.response?.data?.detail || "Failed to update school status.");
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">SchoolVoice — Platform Overview</h1>
          <p className="text-sm text-slate-400 font-medium mt-1">Global administrative console to manage tenant schools, credentials, and platform usage.</p>
        </div>

        {/* Add School Sheet Trigger */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger
            render={
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer">
                <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
                Add School
              </Button>
            }
          />
          
          <SheetContent className="bg-[#1e293b] border-l border-slate-800 text-slate-100 w-full sm:max-w-md">
            <SheetHeader className="space-y-2 pb-6 border-b border-slate-800">
              <SheetTitle className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-500" />
                Register New School
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-400 font-medium">
                Add a new school tenant and automatically provision its first admin user in a secure transaction.
              </SheetDescription>
            </SheetHeader>
            
            <form onSubmit={handleCreateSchool} className="space-y-5 py-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">School Name *</label>
                <Input
                  placeholder="e.g. Delhi Public School"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">City</label>
                <Input
                  placeholder="e.g. New Delhi"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Phone / SIP Number</label>
                <Input
                  placeholder="e.g. +918065481432"
                  value={newSchoolPhone}
                  onChange={(e) => setNewSchoolPhone(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-amber-500" />
                  Primary School Admin
                </h3>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Full Name</label>
                  <Input
                    placeholder="e.g. Principal Dr. Sharma"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Email Address *</label>
                  <Input
                    type="email"
                    placeholder="e.g. principal@dpschool.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-amber-500 text-sm h-10 rounded-lg"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={createLoading}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm tracking-wide rounded-lg transition-all mt-4 cursor-pointer"
              >
                {createLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></span>
                    Provisioning School Tenant...
                  </span>
                ) : (
                  "Provision School"
                )}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* KPI 1: Total Schools */}
        <Card className="bg-[#1e293b] border-slate-800 text-slate-100 hover:border-amber-500/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Schools</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-white">{loading ? "..." : totalSchools}</div>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">Tenant partitions configured</p>
          </CardContent>
        </Card>

        {/* KPI 2: Active Schools */}
        <Card className="bg-[#1e293b] border-slate-800 text-slate-100 hover:border-emerald-500/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Schools</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-white">{loading ? "..." : activeSchools}</div>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">Schools handling callers</p>
          </CardContent>
        </Card>

        {/* KPI 3: Total Calls */}
        <Card className="bg-[#1e293b] border-slate-800 text-slate-100 hover:border-amber-500/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Calls (Month)</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
              <PhoneCall className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-white">{loading ? "..." : totalCallsMonth}</div>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">Incoming / Outbound this month</p>
          </CardContent>
        </Card>

        {/* KPI 4: Total Students */}
        <Card className="bg-[#1e293b] border-slate-800 text-slate-100 hover:border-violet-500/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Students</CardTitle>
            <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400 border border-violet-500/20">
              <Users className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-white">{loading ? "..." : totalStudents}</div>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">Enrolled across all tenants</p>
          </CardContent>
        </Card>
      </div>

      {/* Schools Table Section */}
      <Card className="bg-[#1e293b] border-slate-800">
        <CardHeader className="pb-4 border-b border-slate-800 flex flex-row items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-500" />
              Tenant Schools Registry
            </h2>
            <p className="text-xs text-slate-400 font-medium">Manage and audit tenant databases, telephone routing, and connection status.</p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex h-32 w-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
            </div>
          ) : schools.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <Table>
                <TableHeader className="bg-slate-900/60">
                  <TableRow className="border-b border-slate-800">
                    <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-4 pl-6">School Name</TableHead>
                    <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider">City</TableHead>
                    <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider text-right">Students</TableHead>
                    <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider text-right">Calls (Month)</TableHead>
                    <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider text-right">Last Active</TableHead>
                    <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider text-center pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.map((school) => (
                    <TableRow key={school.id} className="hover:bg-slate-800/40 border-b border-slate-800/80 transition-colors">
                      <TableCell className="font-semibold text-white py-4 pl-6">{school.name}</TableCell>
                      <TableCell className="text-slate-300 font-medium">
                        {school.city ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-500" />
                            {school.city}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">Unspecified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-300 font-bold">{school.stats?.total_students || 0}</TableCell>
                      <TableCell className="text-right text-slate-300 font-bold">{school.stats?.calls_this_month || 0}</TableCell>
                      <TableCell className="text-right text-slate-400 text-xs font-bold">
                        {school.stats?.last_call_at ? (
                          <span className="flex items-center justify-end gap-1">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            {school.stats.last_call_at.split("T")[0]}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">No calls</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border ${
                          school.is_active 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {school.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/super-admin/schools/${school.id}`} passHref>
                            <Button size="sm" variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold px-3 h-8 cursor-pointer">
                              View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openStatusConfirm(school)}
                            className={`text-xs font-semibold px-3 h-8 cursor-pointer ${
                              school.is_active 
                                ? "bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-slate-950 text-rose-400 hover:border-transparent" 
                                : "bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 hover:border-transparent"
                            }`}
                          >
                            {school.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-32 w-full flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-900/10 text-slate-500 font-semibold">
              No school tenants registered. Click "Add School" to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Status Change */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-[#1e293b] border border-slate-800 text-slate-100 w-full max-w-md">
          <DialogHeader className="pb-4 border-b border-slate-800 space-y-2">
            <DialogTitle className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Confirm Status Update
            </DialogTitle>
          </DialogHeader>
          <div className="py-5 text-sm text-slate-300 font-medium leading-relaxed">
            Are you sure you want to {confirmSchool?.is_active ? "DEACTIVATE" : "ACTIVATE"} the school tenant <strong className="text-white">'{confirmSchool?.name}'</strong>?
            {confirmSchool?.is_active && (
              <p className="mt-2 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex gap-2">
                Warning: Deactivating the school immediately blocks dashboard logins and voice-agent caller routes for this tenant.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              variant="outline"
              disabled={statusLoading}
              onClick={() => setIsConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              disabled={statusLoading}
              onClick={handleToggleStatus}
              className={`text-slate-950 font-bold text-xs h-9 px-4 cursor-pointer ${
                confirmSchool?.is_active 
                  ? "bg-rose-500 hover:bg-rose-600 text-white" 
                  : "bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              {statusLoading ? "Updating..." : confirmSchool?.is_active ? "Confirm Deactivation" : "Confirm Activation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials Popup Modal */}
      <Dialog open={isCredentialsModalOpen} onOpenChange={setIsCredentialsModalOpen}>
        <DialogContent className="bg-[#1e293b] border border-slate-800 text-slate-100 w-full max-w-md">
          <DialogHeader className="pb-4 border-b border-slate-800">
            <DialogTitle className="text-md font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="h-5 w-5 stroke-[2.5]" />
              School Created Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 font-medium text-xs leading-relaxed text-slate-300">
            <p className="text-slate-400">Share these login details with the school admin:</p>
            
            {/* Display Credentials Box */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5 space-y-2.5 font-mono text-xs relative overflow-hidden select-all">
              <div>
                <span className="text-slate-500 font-bold">Login URL:</span> <span className="text-amber-500 font-semibold">app.schoolvoice.in/login</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Email:</span> <span className="text-slate-100 font-semibold">{createdCredentials?.admin_user?.email}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Password:</span> <span className="text-emerald-400 font-bold">{createdCredentials?.generated_password}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              onClick={handleCopyCredentials}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 px-4 flex items-center gap-2 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : <Copy className="h-3.5 w-3.5 stroke-[2.5]" />}
              {copied ? "Copied!" : "Copy All"}
            </Button>
            <Button
              onClick={() => setIsCredentialsModalOpen(false)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs h-9 px-4 cursor-pointer"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
