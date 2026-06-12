"use client";

import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface KnowledgeDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  
  // Playground states
  const [playgroundReply, setPlaygroundReply] = useState<string | null>(null);
  const [retrievedContexts, setRetrievedContexts] = useState<string[] | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileTypeBadge = (type: string) => {
    const t = type.toLowerCase();
    switch (t) {
      case "pdf":
        return <Badge className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 uppercase text-xs font-bold font-mono">PDF</Badge>;
      case "docx":
        return <Badge className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 uppercase text-xs font-bold font-mono">DOCX</Badge>;
      case "csv":
        return <Badge className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 uppercase text-xs font-bold font-mono">CSV</Badge>;
      case "xlsx":
      case "xls":
        return <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 uppercase text-xs font-bold font-mono">EXCEL</Badge>;
      case "txt":
        return <Badge className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/20 uppercase text-xs font-bold font-mono">TXT</Badge>;
      case "md":
        return <Badge className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 border border-cyan-500/20 uppercase text-xs font-bold font-mono">MD</Badge>;
      default:
        return <Badge variant="outline" className="uppercase text-xs font-bold font-mono">{t}</Badge>;
    }
  };

  // Fetch documents list from backend
  const fetchDocuments = async () => {
    try {
      const response = await api.get("/knowledge-base/");
      setDocuments(response.data);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll for document status if any document is in "processing" state
  useEffect(() => {
    const hasProcessing = documents.some((doc) => doc.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  // Handle file upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const lowerName = file.name.toLowerCase();
    const allowedExts = [".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt", ".md"];
    if (!allowedExts.some(ext => lowerName.endsWith(ext))) {
      toast.error("Supported formats: PDF, DOCX, CSV, Excel (XLSX/XLS), TXT, and MD");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      await api.post("/knowledge-base/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Document uploaded successfully! Ingesting in background...");
      fetchDocuments();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || "Failed to upload document";
      toast.error(errMsg);
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This will remove all learned facts from the AI assistant.`)) {
      return;
    }

    try {
      await api.delete(`/knowledge-base/${id}`);
      toast.success("Document deleted successfully");
      fetchDocuments();
      // If the deleted document was part of any search, clear search results
      setPlaygroundReply(null);
      setRetrievedContexts(null);
      setLastQuery(null);
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  // Test Q&A playground
  const handlePlaygroundQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const queryText = searchQuery;
    setLastQuery(queryText);
    setSearching(true);
    setPlaygroundReply(null);
    setRetrievedContexts(null);
    setSourcesExpanded(false);

    try {
      const response = await api.post("/knowledge-base/playground/query", {
        query: queryText,
        top_k: 3
      });
      setPlaygroundReply(response.data.reply);
      setRetrievedContexts(response.data.retrieved_contexts);
      setSearchQuery(""); // Clear input field
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || "Failed to query playground assistant";
      toast.error(errMsg);
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusBadge = (status: KnowledgeDocument["status"]) => {
    switch (status) {
      case "processing":
        return <Badge variant="warning" className="animate-pulse">⏳ Processing</Badge>;
      case "ready":
        return <Badge variant="success">🟢 Ingested</Badge>;
      case "failed":
        return <Badge variant="destructive">🔴 Ingest Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn duration-300">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">School Knowledge Base</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
          Upload PDF, DOCX, CSV, Excel, TXT, or MD school documents (e.g. syllabus, calendars, rules, policy documents). 
          The voice assistant uses semantic search to fetch relevant details dynamically during parent calls.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Documents list & upload stacked */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload Zone */}
          <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md transition-colors duration-200">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-amber-50 dark:bg-amber-500/10 p-4 mb-3 border border-amber-250/20 dark:border-amber-500/25">
                <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Upload School Document</h3>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-1 mb-4 font-medium">PDF, Word, CSV, Excel, TXT, or MD formats up to 10MB</p>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept=".pdf,.docx,.csv,.xlsx,.xls,.txt,.md"
                className="hidden"
                id="kb-file-upload"
              />
              
              <Button
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold shadow-sm transition-all"
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></span>
                    Uploading...
                  </div>
                ) : (
                  "Choose File"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <Card className="glass-panel border-slate-200 dark:border-slate-800/80 shadow-md">
            <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/80">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">Knowledge Documents</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                These documents are fully processed and indexable for semantic search.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {documents.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                      <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                        <TableHead className="pl-6 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Document Name</TableHead>
                        <TableHead className="py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Type</TableHead>
                        <TableHead className="py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Size</TableHead>
                        <TableHead className="py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Chunks</TableHead>
                        <TableHead className="py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Status</TableHead>
                        <TableHead className="pr-6 py-3 text-right font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-slate-50/45 dark:hover:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/60 transition-colors duration-150">
                          <TableCell className="pl-6 py-4 font-bold text-slate-900 dark:text-white max-w-[200px] truncate" title={doc.filename}>
                            {doc.filename}
                          </TableCell>
                          <TableCell className="py-4">
                            {getFileTypeBadge(doc.file_type)}
                          </TableCell>
                          <TableCell className="py-4 text-xs font-medium text-slate-500 dark:text-slate-400">{formatBytes(doc.file_size)}</TableCell>
                          <TableCell className="py-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{doc.chunk_count || 0}</TableCell>
                          <TableCell className="py-4">{getStatusBadge(doc.status)}</TableCell>
                          <TableCell className="pr-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(doc.id, doc.filename)}
                              className="h-8 w-8 p-0 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-350 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full cursor-pointer"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-450 dark:text-slate-500 text-sm font-semibold">
                  No documents uploaded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: AI Assistant Q&A Playground */}
        <div className="space-y-6">
          <Card className="glass-panel border-slate-200 dark:border-slate-800/80 shadow-md flex flex-col h-[550px]">
            <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                Q&A PLAYGROUND
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Test how the AI voice agent will answer parents' queries using your ingested documents.
              </CardDescription>
            </CardHeader>
            
            {/* Chat Area */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-50/50 dark:bg-slate-950/20">
              {!lastQuery && !searching ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="rounded-full bg-slate-100 dark:bg-slate-900 p-3 text-slate-400 dark:text-slate-650">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Playground Ready</p>
                    <p className="text-[11px] text-slate-550 dark:text-slate-450 mt-1 max-w-[200px] leading-normal">
                      Ask a natural language question below to check search retrieval & synthesis.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* User Query Bubble */}
                  {lastQuery && (
                    <div className="flex justify-end animate-fadeIn">
                      <div className="max-w-[85%] bg-amber-500 text-slate-950 rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm text-xs font-bold leading-relaxed">
                        {lastQuery}
                      </div>
                    </div>
                  )}

                  {/* AI Response Loading */}
                  {searching && (
                    <div className="flex gap-3 items-start">
                      <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        🤖
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm text-xs">
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="h-2 w-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="h-2 w-2 bg-amber-500 rounded-full animate-bounce"></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Response Reply Bubble */}
                  {playgroundReply && (
                    <div className="space-y-3">
                      <div className="flex gap-3 items-start animate-fadeIn">
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/25 dark:bg-amber-500/20 flex items-center justify-center text-amber-555 dark:text-amber-400 font-bold shrink-0">
                          AI
                        </div>
                        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {playgroundReply}
                          
                          {/* Collapsible Source Chunks */}
                          {retrievedContexts && retrievedContexts.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-150 dark:border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                                className="flex items-center justify-between w-full text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors uppercase tracking-wider focus:outline-none cursor-pointer"
                              >
                                <span>Sources Retrieved ({retrievedContexts.length})</span>
                                <svg
                                  className={`h-3.5 w-3.5 transform transition-transform duration-200 ${sourcesExpanded ? "rotate-180" : ""}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {sourcesExpanded && (
                                <div className="mt-2 space-y-2 max-h-[160px] overflow-y-auto pr-1 animate-fadeIn">
                                  {retrievedContexts.map((context, i) => (
                                    <div
                                      key={i}
                                      className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-855 text-[10px] text-slate-600 dark:text-slate-400 font-normal leading-normal"
                                    >
                                      <span className="font-bold text-amber-600 dark:text-amber-450 mr-1">#{i + 1}</span>
                                      {context}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 shrink-0 bg-white dark:bg-slate-900 rounded-b-xl">
              <form onSubmit={handlePlaygroundQuery} className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searching ? "Assistant is thinking..." : "Ask the assistant about school details..."}
                  disabled={searching}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-605 focus-visible:ring-amber-500 text-xs py-2 h-9"
                />
                <Button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 h-9 shrink-0 shadow-sm cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
