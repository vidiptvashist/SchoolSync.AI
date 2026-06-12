"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Send, ArrowLeft, Loader2, Circle } from "lucide-react";
import { toast } from "sonner";

// Interfaces
interface SchoolInfo {
  school_id: string;
  name: string;
  primary_color: string;
  logo_url: string | null;
  greeting: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Utility to verify JWT expiration without external library
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (e) {
    return true;
  }
}

export default function ParentChatPage() {
  const params = useParams();
  const schoolId = params?.school_id as string;

  // School branding and info states
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);

  // Screen routing state: 'phone' | 'otp' | 'chat'
  const [screen, setScreen] = useState<"phone" | "otp" | "chat">("phone");

  // OTP and Phone states
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Chat conversation states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");

  // Refs for auto-focusing OTP boxes and auto-scrolling chat
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const chatEndRef = useRef<HTMLDivElement>(null);

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Axios instance localized with parent session token
  const getChatApi = () => {
    const token = localStorage.getItem(`chat_token_${schoolId}`);
    return axios.create({
      baseURL: BASE_URL,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  // Extract school name initials for avatar logo fallback
  const getInitials = (name: string) => {
    if (!name) return "SCH";
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  };

  // 1. Fetch school branding on load
  useEffect(() => {
    if (!schoolId) return;

    const fetchBranding = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/chat/school-info?sid=${schoolId}`);
        const data: SchoolInfo = res.data;
        setSchoolInfo(data);
        document.title = `${data.name} — Parent Assistant`;

        // Check for existing session token in localStorage
        const storedToken = localStorage.getItem(`chat_token_${schoolId}`);
        if (storedToken && !isTokenExpired(storedToken)) {
          // Token is valid - skip to Chat Screen
          const cachedStudent = localStorage.getItem(`chat_student_${schoolId}`) || "";
          const cachedClass = localStorage.getItem(`chat_class_${schoolId}`) || "";
          const cachedHistory = localStorage.getItem(`chat_history_${schoolId}`);
          
          setStudentName(cachedStudent);
          setClassName(cachedClass);
          
          if (cachedHistory) {
            try {
              setMessages(JSON.parse(cachedHistory));
            } catch (e) {
              // fallback if history is corrupted
              setMessages([
                { role: "assistant", content: `Welcome back! Continuing our conversation. How can I help you regarding ${cachedStudent}?` }
              ]);
            }
          } else {
            setMessages([
              { role: "assistant", content: `Welcome back! Continuing our conversation. How can I help you regarding ${cachedStudent}?` }
            ]);
          }
          setScreen("chat");
        }
      } catch (err) {
        console.error("Failed to load school branding:", err);
        toast.error("Invalid school link or network error");
      } finally {
        setLoadingSchool(false);
      }
    };

    fetchBranding();
  }, [schoolId]);

  // 2. Countdown timer logic for OTP screen
  useEffect(() => {
    if (screen === "otp" && resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [screen, resendCountdown]);

  // 3. Auto-scroll to bottom of chat feed
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendingMessage]);

  // Handle Request OTP submit
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    setSendingOtp(true);
    try {
      // Body payload format matches database requirements
      await axios.post(`${BASE_URL}/chat/request-otp`, {
        phone: phone.trim(),
        school_id: schoolId,
      });
      toast.success("OTP sent to your mobile number");
      setResendCountdown(30);
      setScreen("otp");
      // Auto focus the first box
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to request OTP. Try again.";
      toast.error(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle Verify OTP submit
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length < 4) {
      toast.error("Please enter the 4-digit code");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await axios.post(`${BASE_URL}/chat/verify-otp`, {
        phone: phone.trim(),
        school_id: schoolId,
        otp: otpCode,
      });

      const { chat_token, student_name, class_name } = res.data;
      
      // Save credentials locally
      localStorage.setItem(`chat_token_${schoolId}`, chat_token);
      localStorage.setItem(`chat_student_${schoolId}`, student_name || "");
      localStorage.setItem(`chat_class_${schoolId}`, class_name || "");
      
      setStudentName(student_name || "");
      setClassName(class_name || "");

      // Setup initial messages
      const initialGreeting = schoolInfo?.greeting || `Hi! I can help you with queries regarding ${student_name}.`;
      const welcomeMsg: Message = {
        role: "assistant",
        content: `${initialGreeting} What would you like to know today?`
      };
      setMessages([welcomeMsg]);
      localStorage.setItem(`chat_history_${schoolId}`, JSON.stringify([welcomeMsg]));

      toast.success("OTP Verified Successfully!");
      setScreen("chat");
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid or expired OTP";
      toast.error(msg);
      // Clear OTP boxes
      setOtp(["", "", "", ""]);
      otpRefs[0].current?.focus();
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Handle OTP digit entry
  const handleOtpChange = (val: string, index: number) => {
    const cleanVal = val.replace(/[^0-9]/g, "").slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = cleanVal;
    setOtp(newOtp);

    // Auto focus next box
    if (cleanVal && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  // Handle Backspace navigation in OTP boxes
  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // Send Message flow
  const handleSendMessage = async (textToSend: string) => {
    const trimmedText = textToSend.trim();
    if (!trimmedText) return;

    setInputMessage("");
    setSendingMessage(true);

    const userMsg: Message = { role: "user", content: trimmedText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    
    // Save to local history (keep last 10 messages for simple state restoration)
    localStorage.setItem(`chat_history_${schoolId}`, JSON.stringify(updatedMessages.slice(-10)));

    try {
      const apiInstance = getChatApi();
      const res = await apiInstance.post("/chat/message", {
        message: trimmedText,
      });

      const replyText = res.data.reply;
      const assistantMsg: Message = { role: "assistant", content: replyText };
      
      const newHistory = [...updatedMessages, assistantMsg];
      setMessages(newHistory);
      localStorage.setItem(`chat_history_${schoolId}`, JSON.stringify(newHistory.slice(-10)));
    } catch (err: any) {
      console.error("Message send failed:", err);
      
      if (err.response?.status === 400 && err.response?.data?.detail === "Chat session has ended") {
        toast.error("Session timed out due to inactivity. Please log in again.");
        localStorage.removeItem(`chat_token_${schoolId}`);
        localStorage.removeItem(`chat_student_${schoolId}`);
        localStorage.removeItem(`chat_class_${schoolId}`);
        localStorage.removeItem(`chat_history_${schoolId}`);
        setTimeout(() => {
          setScreen("phone");
          setMessages([]);
        }, 1500);
        return;
      }

      const errorMsg: Message = {
        role: "assistant",
        content: "I'm sorry, I'm having trouble connecting to the school servers. Please check your connection and try again."
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSendingMessage(false);
    }
  };

  // Suggestion chips handler
  const handleChipClick = (query: string) => {
    handleSendMessage(query);
  };

  // Default color setup
  // Helper to dynamically adjust color brightness for gradients
  const adjustColorBrightness = (hex: string, percent: number) => {
    try {
      let R = parseInt(hex.substring(1, 3), 16);
      let G = parseInt(hex.substring(3, 5), 16);
      let B = parseInt(hex.substring(5, 7), 16);

      R = Math.max(0, Math.min(255, R + (R * percent) / 100));
      G = Math.max(0, Math.min(255, G + (G * percent) / 100));
      B = Math.max(0, Math.min(255, B + (B * percent) / 100));

      const rHex = Math.round(R).toString(16).padStart(2, "0");
      const gHex = Math.round(G).toString(16).padStart(2, "0");
      const bHex = Math.round(B).toString(16).padStart(2, "0");

      return `#${rHex}${gHex}${bHex}`;
    } catch (e) {
      return hex;
    }
  };

  const primaryColor = schoolInfo?.primary_color || "#1e40af";

  if (loadingSchool) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50/50 backdrop-blur-md">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-slate-400" />
          <p className="text-sm font-semibold text-slate-500 tracking-wide">Connecting to SchoolSync.AI...</p>
        </div>
      </div>
    );
  }

  if (!schoolInfo) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-sm p-6 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-xl">
          <h3 className="text-lg font-bold text-slate-800">Portal Link Invalid</h3>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">This assistant portal cannot be loaded. Please ensure you clicked the link correctly or contact your school administration.</p>
        </div>
      </div>
    );
  }

  // --- SCREEN 1: Phone Entry ---
  if (screen === "phone") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 font-sans relative overflow-hidden">
        {/* Sleek light-mesh grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] -z-10 opacity-70"></div>
        
        {/* Dynamic ambient color glowing blobs */}
        <div className="absolute -top-[20%] -left-[10%] w-[350px] h-[350px] rounded-full blur-[120px] opacity-[0.15] -z-10 transition-all duration-1000" style={{ backgroundColor: primaryColor }}></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.12] -z-10 transition-all duration-1000" style={{ backgroundColor: primaryColor }}></div>

        <div className="w-full max-w-[420px] bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.04)] p-7 text-center space-y-6 relative overflow-hidden animate-in fade-in zoom-in duration-300">
          {/* Subtle top brand colored bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: primaryColor }}></div>

          {/* Logo / Initials */}
          <div className="flex justify-center pt-2">
            {schoolInfo.logo_url ? (
              <img
                src={schoolInfo.logo_url.startsWith("http") ? schoolInfo.logo_url : `${BASE_URL}${schoolInfo.logo_url}`}
                alt={schoolInfo.name}
                className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-md"
              />
            ) : (
              <div
                style={{ backgroundColor: primaryColor }}
                className="h-16 w-16 rounded-full flex items-center justify-center text-white font-extrabold text-xl shadow-md border-2 border-white"
              >
                {getInitials(schoolInfo.name)}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-snug">{schoolInfo.name}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Smart Parent Assistant</p>
          </div>

          <div className="h-px bg-slate-100/80 w-full" />

          <form onSubmit={handleRequestOtp} className="space-y-5 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5 block">
                Registered Mobile Number
              </label>
              <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-4 focus-within:ring-slate-900/5 focus-within:border-slate-400 transition-all duration-200">
                <span className="bg-slate-50/60 px-3.5 py-3 text-slate-500 font-semibold text-sm border-r border-slate-100 select-none flex items-center">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                  className="w-full px-3.5 py-3 bg-transparent text-slate-800 text-sm outline-none font-mono tracking-wider"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={sendingOtp}
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColorBrightness(primaryColor, -15)} 100%)`
              }}
              className="w-full text-white py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 duration-200"
            >
              {sendingOtp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Requesting...
                </>
              ) : (
                "Request Verification OTP"
              )}
            </button>
          </form>

          <p className="text-xs text-slate-400 leading-normal font-medium">
            Access is secure. Your phone number must match the registered parent register to establish a chat session.
          </p>
        </div>

        {/* Brand Footer */}
        <div className="flex items-center gap-1.5 mt-6 opacity-60">
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
            SchoolSync.AI
          </span>
          <span className="text-slate-300 text-xs">•</span>
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
            Parent Portal
          </span>
        </div>
      </div>
    );
  }

  // --- SCREEN 2: OTP Verification ---
  if (screen === "otp") {
    const maskedPhone = phone.length >= 10 ? `+91 ${phone.slice(0, 2)}****${phone.slice(-4)}` : phone;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 font-sans relative overflow-hidden">
        {/* Sleek light-mesh grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] -z-10 opacity-70"></div>
        
        {/* Dynamic ambient color glowing blobs */}
        <div className="absolute -top-[20%] -left-[10%] w-[350px] h-[350px] rounded-full blur-[120px] opacity-[0.15] -z-10 transition-all duration-1000" style={{ backgroundColor: primaryColor }}></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.12] -z-10 transition-all duration-1000" style={{ backgroundColor: primaryColor }}></div>

        <div className="w-full max-w-[420px] bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.04)] p-7 text-center space-y-6 relative overflow-hidden animate-in fade-in zoom-in duration-300">
          {/* Subtle top brand colored bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: primaryColor }}></div>

          <div className="flex items-center gap-2.5 justify-start">
            <button
              onClick={() => setScreen("phone")}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100/50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{schoolInfo.name}</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Verify Your Identity</h2>
            <p className="text-xs text-slate-500 font-medium">
              We sent a 4-digit verification code to <span className="font-mono font-semibold text-slate-700">{maskedPhone}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            {/* 4 Digit inputs */}
            <div className="flex justify-center gap-3">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={otpRefs[idx]}
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={1}
                  required
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  className="w-12 h-12 text-center text-xl font-bold bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-400 text-slate-800 transition-all shadow-sm duration-150"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={verifyingOtp}
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColorBrightness(primaryColor, -15)} 100%)`
              }}
              className="w-full text-white py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 duration-200"
            >
              {verifyingOtp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Verify & Join Chat"
              )}
            </button>
          </form>

          {/* Resend countdown or link */}
          <div className="text-xs pt-1">
            {resendCountdown > 0 ? (
              <span className="text-slate-400 font-semibold">Resend OTP in {resendCountdown}s</span>
            ) : (
              <button
                onClick={handleRequestOtp}
                style={{ color: primaryColor }}
                className="font-bold hover:opacity-85 underline cursor-pointer"
              >
                Resend OTP
              </button>
            )}
          </div>
        </div>

        {/* Brand Footer */}
        <div className="flex items-center gap-1.5 mt-6 opacity-60">
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
            SchoolSync.AI
          </span>
          <span className="text-slate-300 text-xs">•</span>
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
            Parent Portal
          </span>
        </div>
      </div>
    );
  }

  // --- SCREEN 3: Full-Viewport Chat Screen ---
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans relative">
      {/* Sleek light-mesh grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:3rem_3rem] -z-10 opacity-60"></div>

      <div className="mx-auto w-full max-w-[480px] h-full flex flex-col bg-white border-x border-slate-200/60 shadow-[0_0_40px_rgba(0,0,0,0.02)] relative">
        {/* Dynamic header with primary_color gradient */}
        <header
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColorBrightness(primaryColor, -15)} 100%)`
          }}
          className="flex items-center justify-between px-4 py-3.5 text-white shadow-sm shrink-0 z-10 relative overflow-hidden"
        >
          {/* Subtle gloss overlay */}
          <div className="absolute inset-0 bg-white/[0.04] pointer-events-none"></div>

          <div className="flex items-center gap-3">
            {schoolInfo.logo_url ? (
              <img
                src={schoolInfo.logo_url.startsWith("http") ? schoolInfo.logo_url : `${BASE_URL}${schoolInfo.logo_url}`}
                alt={schoolInfo.name}
                className="h-9 w-9 rounded-full object-cover border border-white/20 bg-white shadow-xs"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-white/12 flex items-center justify-center font-bold text-xs border border-white/15 shadow-xs">
                {getInitials(schoolInfo.name)}
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-tight">{schoolInfo.name}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Circle className="h-1.5 w-1.5 fill-emerald-400 text-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold tracking-widest uppercase text-white/90">SchoolSync AI</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable chat body */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                <div
                  style={isUser ? {
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColorBrightness(primaryColor, -10)} 100%)`
                  } : {}}
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? "text-white rounded-tr-none shadow-sm shadow-indigo-500/5 select-text"
                      : "bg-white text-slate-800 border border-slate-100 rounded-tl-none shadow-[0_2px_8px_rgba(0,0,0,0.02)] select-text"
                  }`}
                >
                  <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {sendingMessage && (
            <div className="flex justify-start animate-in fade-in duration-150">
              <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-center space-x-1.5 h-10 w-16">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}

          {/* Suggestion Chips - shown only before user sends first message */}
          {messages.length <= 1 && !sendingMessage && (
            <div className="pt-2 space-y-2 animate-in fade-in slide-in-from-left-2 duration-300 delay-150">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 block">
                Quick Enquiries
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "📋 Attendance", query: "What is my child's attendance?" },
                  { label: "💰 Fee Status", query: "What is the pending fee status?" },
                  { label: "📅 Exam Schedule", query: "What is the exam schedule?" },
                  { label: "🏫 Timings", query: "What are the school timings?" },
                ].map((chip, chipIdx) => (
                  <button
                    key={chipIdx}
                    onClick={() => handleChipClick(chip.query)}
                    className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 text-xs font-semibold text-slate-600 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.02)] active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }}></span>
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </main>

        {/* Dynamic chat input inside a cohesive floating pill */}
        <footer className="p-4 border-t border-slate-100 bg-white shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputMessage);
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200/80 rounded-2xl focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-900/5 focus-within:border-slate-400 transition-all duration-200 pr-1 pl-1">
              <input
                type="text"
                disabled={sendingMessage}
                placeholder="Type your question here..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-4 py-3 bg-transparent text-slate-800 text-sm outline-none placeholder-slate-400 disabled:opacity-50 font-medium"
              />
              <button
                type="submit"
                disabled={sendingMessage || !inputMessage.trim()}
                style={{ backgroundColor: primaryColor }}
                className="p-2.5 rounded-xl text-white hover:opacity-90 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
}
