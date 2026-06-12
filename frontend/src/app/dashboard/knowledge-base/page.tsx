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
  file_type: "pdf" | "docx";
  file_size: number;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

interface SearchResult {
  query: string;
  results: string[];
  count: number;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx")) {
      toast.error("Only PDF and DOCX files are supported.");
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
      setSearchResults(null);
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  // Test search playground
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await api.get(`/knowledge-base/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data.results);
    } catch (error) {
      toast.error("Failed to search knowledge base");
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
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">School Knowledge Base</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload PDF/DOCX school documents (e.g. syllabus, calendars, rules, policy documents). 
          The voice assistant uses semantic search to fetch relevant details dynamically during parent calls.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Documents list & upload */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload Zone */}
          <Card className="border-dashed border-2 border-slate-200 hover:border-indigo-400 transition-colors duration-200">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-indigo-50 p-4 mb-3">
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Upload School Document</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">PDF or Word (.docx) formats up to 10MB</p>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept=".pdf,.docx"
                className="hidden"
                id="kb-file-upload"
              />
              
              <Button
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm"
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Uploading...
                  </div>
                ) : (
                  "Choose File"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-800">Knowledge Documents</CardTitle>
              <CardDescription className="text-xs">
                These documents are fully processed and indexable for semantic search.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {documents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="pl-6 py-3 text-xs font-semibold text-slate-500">Document Name</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-500">Type</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-500">Size</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-500">Chunks</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-500">Status</TableHead>
                      <TableHead className="pr-6 py-3 text-right text-xs font-semibold text-slate-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-slate-50/40 transition-colors">
                        <TableCell className="pl-6 py-4 font-medium text-slate-900 max-w-[200px] truncate" title={doc.filename}>
                          {doc.filename}
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="uppercase text-xs font-bold text-slate-500">{doc.file_type}</span>
                        </TableCell>
                        <TableCell className="py-4 text-xs text-slate-500">{formatBytes(doc.file_size)}</TableCell>
                        <TableCell className="py-4 font-mono text-xs">{doc.chunk_count || 0}</TableCell>
                        <TableCell className="py-4">{getStatusBadge(doc.status)}</TableCell>
                        <TableCell className="pr-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.id, doc.filename)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full"
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
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No documents uploaded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Search Playground */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Playground
              </CardTitle>
              <CardDescription className="text-xs">
                Query the knowledge base using natural language to check what facts the voice agent can retrieve.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. When is the summer vacation starting?"
                    className="bg-white border-slate-200 text-slate-800 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <Button
                    type="submit"
                    disabled={searching || !searchQuery.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0"
                  >
                    {searching ? "..." : "Search"}
                  </Button>
                </div>
              </form>

              <div className="mt-6 space-y-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search Results</h4>
                {searchResults !== null ? (
                  searchResults.length > 0 ? (
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-slate-700 leading-relaxed relative"
                        >
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold scale-90">
                            #{index + 1}
                          </span>
                          <p className="pr-6">{result}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl">
                      No matching chunks found in Qdrant.
                    </div>
                  )
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl">
                    Type a query above and search to test retrieval.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
