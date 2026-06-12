"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { 
  Building, 
  MapPin, 
  Palette, 
  Upload, 
  Link as LinkIcon, 
  Copy, 
  ExternalLink, 
  Download, 
  MessageSquare,
  Sparkles,
  HelpCircle,
  FileImage,
  RefreshCw
} from "lucide-react";

import api from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1e40af");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch school settings
  const fetchSchoolSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/schools/me");
      setSchool(res.data);
      setName(res.data.name || "");
      setCity(res.data.city || "");
      setPrimaryColor(res.data.primary_color || "#1e40af");
      
      // If logo exists on backend, set the preview
      if (res.data.logo_url) {
        // Resolve path to the backend URL base if relative
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        setLogoPreview(`${apiBaseUrl}${res.data.logo_url}?t=${new Date().getTime()}`);
      } else {
        setLogoPreview(null);
      }
    } catch (err: any) {
      console.error("Failed to load settings:", err);
      toast.error(err?.response?.data?.detail || "Failed to load school settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolSettings();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("School name is required.");
      return;
    }
    try {
      setSavingProfile(true);
      const res = await api.patch("/schools/me", { name, city });
      setSchool(res.data);
      toast.success("School profile updated successfully!");
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      toast.error(err?.response?.data?.detail || "Failed to update school profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 500KB)
    if (file.size > 500 * 1024) {
      toast.error("Image file size must be under 500KB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate type
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only PNG, JPG, or JPEG images are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingBranding(true);
      const formData = new FormData();
      formData.append("primary_color", primaryColor);
      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const res = await api.patch("/schools/me/branding", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSchool(res.data);
      setLogoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Update logo preview with cache-buster if url returned
      if (res.data.logo_url) {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        setLogoPreview(`${apiBaseUrl}${res.data.logo_url}?t=${new Date().getTime()}`);
      }
      
      toast.success("Widget branding configurations updated!");
    } catch (err: any) {
      console.error("Failed to update branding:", err);
      toast.error(err?.response?.data?.detail || "Failed to update branding configurations.");
    } finally {
      setSavingBranding(false);
    }
  };

  // Build Parent Chat Widget URL
  const getParentChatUrl = () => {
    if (!school?.id) return "";
    if (typeof window !== "undefined") {
      return `${window.location.origin}/chat/${school.id}`;
    }
    return `http://localhost:3000/chat/${school.id}`;
  };

  const chatUrl = getParentChatUrl();

  const copyLinkToClipboard = () => {
    if (!chatUrl) return;
    navigator.clipboard.writeText(chatUrl);
    toast.success("Parent chat link copied to clipboard!");
  };

  const openPreview = () => {
    if (!chatUrl) return;
    window.open(chatUrl, "_blank");
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById("parent-chat-qr") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `${school?.name || "school"}_chat_qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      toast.success("QR Code downloaded successfully!");
    } else {
      toast.error("Failed to generate QR Code for download.");
    }
  };

  const getInitials = (schoolName: string) => {
    if (!schoolName) return "SCH";
    return schoolName
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-slate-500">Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn duration-200">
      
      {/* Header Banner */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">
          Configure profile details, custom branding variables, and parent assistant entry points.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl w-fit flex gap-1 border border-slate-200">
          <TabsTrigger 
            value="profile"
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm text-slate-600 hover:text-slate-900"
          >
            <Building className="h-4 w-4 mr-2 inline" />
            School Profile
          </TabsTrigger>
          <TabsTrigger 
            value="branding"
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm text-slate-600 hover:text-slate-900"
          >
            <Palette className="h-4 w-4 mr-2 inline" />
            Chat Branding
          </TabsTrigger>
          <TabsTrigger 
            value="link"
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm text-slate-600 hover:text-slate-900"
          >
            <LinkIcon className="h-4 w-4 mr-2 inline" />
            Parent Chat Link
          </TabsTrigger>
        </TabsList>

        {/* School Profile Tab */}
        <TabsContent value="profile" className="outline-none">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-6">
              School Profile Configuration
            </h3>
            
            <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-xl">
              <div className="space-y-2">
                <Label htmlFor="school-name" className="text-slate-700 font-semibold text-xs uppercase tracking-wider">
                  School Name
                </Label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
                  <Input
                    id="school-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter school name"
                    className="pl-11 h-11 border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-city" className="text-slate-700 font-semibold text-xs uppercase tracking-wider">
                  City
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
                  <Input
                    id="school-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter city"
                    className="pl-11 h-11 border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              {/* Read only info fields */}
              <div className="pt-4 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Contact Phone
                  </span>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">
                    {school?.phone || "None Configured"}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={savingProfile}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl h-11 shadow-sm transition-all duration-150"
                >
                  {savingProfile ? "Saving Profile..." : "Save Profile Details"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* Chat Branding Tab */}
        <TabsContent value="branding" className="outline-none">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-6">
              Chat Widget Customisation
            </h3>
            
            <form onSubmit={handleBrandingSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Form inputs section */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Primary Color Picker */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-slate-700 font-semibold text-xs uppercase tracking-wider">
                      Primary Brand Color
                    </Label>
                    <span className="text-xs font-mono font-bold text-slate-400 select-all">
                      {primaryColor}
                    </span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-12 w-14 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white shadow-sm flex-shrink-0"
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#1e40af"
                      maxLength={9}
                      className="h-11 border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    This color will brand the header, primary buttons, user bubbles, and accents inside the parent widget.
                  </p>
                </div>

                {/* Logo Image Upload */}
                <div className="space-y-3">
                  <Label className="text-slate-700 font-semibold text-xs uppercase tracking-wider">
                    School Logo
                  </Label>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    {/* Logo Circle Preview */}
                    <div className="h-16 w-16 rounded-full border border-slate-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      {logoPreview ? (
                        <img 
                          src={logoPreview} 
                          alt="Logo Preview" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div 
                          className="h-full w-full flex items-center justify-center font-bold text-lg text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {getInitials(name)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 w-full text-center sm:text-left">
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="border-slate-300 text-slate-700 h-10 w-full sm:w-auto hover:bg-white transition-all"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Logo Image
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoChange}
                        accept="image/png, image/jpeg, image/jpg"
                        className="hidden"
                      />
                      <p className="text-[11px] text-slate-400 mt-2 font-medium">
                        Supported: PNG, JPG, JPEG (Max size: 500KB)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Button 
                    type="submit" 
                    disabled={savingBranding}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl h-11 shadow-sm transition-all duration-150"
                  >
                    {savingBranding ? "Saving Branding..." : "Save Branding Options"}
                  </Button>
                </div>

              </div>

              {/* Visual Widget Preview section */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[320px] rounded-2xl border border-slate-200 bg-slate-50 shadow-md overflow-hidden font-sans">
                  
                  {/* Chat Widget Header */}
                  <div 
                    className="px-4 py-3 text-white flex items-center gap-3 transition-colors duration-200"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <div className="h-9 w-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {logoPreview ? (
                        <img 
                          src={logoPreview} 
                          alt="Logo Preview" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-xs">
                          {getInitials(name)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-xs leading-snug truncate max-w-[180px]">
                        {name || "Your School Name"}
                      </p>
                      <p className="text-[10px] text-white/80 font-medium">
                        Parent Assistant
                      </p>
                    </div>
                  </div>

                  {/* Chat Widget Conversation Area */}
                  <div className="p-4 space-y-4 min-h-[220px] bg-slate-50 text-xs">
                    
                    {/* Bot Greeting Bubble */}
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div 
                        className="h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] text-white flex-shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {getInitials(name)}
                      </div>
                      <div className="bg-white border border-slate-100 text-slate-800 p-2.5 rounded-2xl rounded-tl-none shadow-sm font-medium">
                        Hi! I'm your assistant for {name || "Your School"}. How can I help you today?
                      </div>
                    </div>

                    {/* User Reply Bubble */}
                    <div className="flex items-start justify-end gap-2 max-w-[85%] ml-auto">
                      <div 
                        className="text-white p-2.5 rounded-2xl rounded-tr-none shadow-sm font-medium transition-colors duration-200"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Can you tell me the current fee dues for my child?
                      </div>
                    </div>

                    {/* Bot Reply Loading indicator */}
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div 
                        className="h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] text-white flex-shrink-0 animate-pulse"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {getInitials(name)}
                      </div>
                      <div className="bg-white border border-slate-100 p-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5 py-3">
                        <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>

                  </div>

                  {/* Chat Widget Footer Input Bar */}
                  <div className="p-3 border-t border-slate-200/60 bg-white flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-8 px-3 text-[10px] text-slate-400 flex items-center font-medium border border-slate-100">
                      Type your query here...
                    </div>
                    <div 
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white cursor-pointer shadow-sm transition-colors duration-200"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Sparkles className="h-3 w-3" />
                    </div>
                  </div>

                </div>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-4">
                  Widget Visual Preview
                </span>
              </div>

            </form>
          </div>
        </TabsContent>

        {/* Parent Chat Link Tab */}
        <TabsContent value="link" className="outline-none">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-6">
              Parent Portal Shareable Links
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Copy links options */}
              <div className="md:col-span-7 space-y-6">
                
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold text-xs uppercase tracking-wider">
                    Shareable Chat URL
                  </Label>
                  
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={chatUrl}
                      readOnly
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="h-11 border-slate-200 bg-slate-50 font-mono text-xs select-all text-slate-600 flex-1 cursor-default"
                    />
                    <Button
                      type="button"
                      onClick={copyLinkToClipboard}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-11 px-4 rounded-xl flex-shrink-0"
                    >
                      <Copy className="h-4.5 w-4.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openPreview}
                      className="border-slate-200 hover:bg-slate-50 font-semibold h-11 px-4 rounded-xl text-slate-700 flex-shrink-0"
                    >
                      <ExternalLink className="h-4.5 w-4.5" />
                    </Button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 text-xs space-y-2.5 text-slate-600">
                  <div className="flex gap-2 items-start font-medium text-slate-700">
                    <HelpCircle className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span>How should I share this link?</span>
                  </div>
                  <p className="leading-relaxed">
                    Share this link with parents via WhatsApp broadcast messages, embed it as a button in your custom parent mobile app, or copy it directly onto school circulars.
                  </p>
                  <p className="leading-relaxed">
                    Parents who open this link can sign in securely using their phone numbers and a one-time SMS password (OTP). There is no app installation required.
                  </p>
                </div>

              </div>

              {/* QR Code generator */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-6 border border-slate-100 bg-slate-50/50 rounded-2xl">
                
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                  {school?.id ? (
                    <QRCodeCanvas
                      id="parent-chat-qr"
                      value={chatUrl}
                      size={160}
                      level="H"
                      includeMargin={true}
                    />
                  ) : (
                    <div className="h-40 w-40 flex items-center justify-center bg-slate-100 text-slate-400 text-xs font-semibold">
                      Generating QR...
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={downloadQRCode}
                  className="mt-5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold h-10 px-5 rounded-xl shadow-sm text-xs"
                >
                  <Download className="h-4 w-4 mr-2 text-indigo-600" />
                  Download QR Code
                </Button>

                <p className="text-[10px] text-slate-400 text-center mt-3 max-w-[200px]">
                  Download this QR code image to print on school flyers, banners, or report cards.
                </p>

              </div>

            </div>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
