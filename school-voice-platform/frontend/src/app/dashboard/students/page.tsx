"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Student {
  id: string;
  name: string;
  class_name: string;
  section: string;
  roll_number: string;
  parent_name: string;
  parent_phone: string;
  created_at: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [openUpload, setOpenUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch student roster from FastAPI
  const fetchStudents = async (query = "") => {
    try {
      const response = await api.get("/students/", {
        params: { search: query },
      });
      setStudents(response.data);
    } catch (error) {
      toast.error("Failed to load student directory");
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success("Student deleted successfully");
      fetchStudents(search);
    } catch (error) {
      toast.error("Failed to delete student");
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    fetchStudents(value);
  };

  // Triggers local template download
  const handleDownloadTemplate = () => {
    const csvContent =
      "name,class_name,section,roll_number,parent_name,parent_phone\n" +
      "John Doe,5,A,101,Mr. Doe,9876543210\n" +
      "Jane Smith,5,A,102,Mrs. Smith,8765432109\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "student_roster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Template downloaded!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Uploads CSV/Excel to FastAPI
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a valid CSV or Excel file to upload");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post("/students/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const { uploaded, updated, errors } = response.data;

      if (errors && errors.length > 0) {
        toast.warning(
          `Completed with errors. Added: ${uploaded}, Updated: ${updated}. Had ${errors.length} errors.`
        );
      } else {
        toast.success(
          `Successfully processed! Added ${uploaded} new records and updated ${updated} existing records.`
        );
      }

      setOpenUpload(false);
      setSelectedFile(null);
      fetchStudents(search);
    } catch (error: any) {
      const detail = error.response?.data?.detail || "Upload execution failed";
      toast.error(detail);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header with Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Student Directory</h2>
          <p className="text-sm text-slate-500">
            Manage your school's student contacts, classes, and parent details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-150 shadow-sm"
          >
            Download Template
          </Button>
          <Button
            onClick={() => setOpenUpload(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all duration-150 shadow-sm"
          >
            Upload CSV
          </Button>
        </div>
      </div>

      {/* Directory Table Area */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Search Input Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="max-w-md">
            <Input
              type="text"
              placeholder="Search by student name or parent phone..."
              value={search}
              onChange={handleSearchChange}
              className="bg-white border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm"
            />
          </div>
        </div>

        {/* ShadCN Data Table */}
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold text-slate-700 w-[20%]">Name</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[15%] text-center">Class</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[15%] text-center">Section</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[20%]">Parent Name</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[20%]">Parent Phone</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length > 0 ? (
              students.map((student) => (
                <TableRow key={student.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                  <TableCell className="font-medium text-slate-800">{student.name}</TableCell>
                  <TableCell className="text-center text-slate-600">{student.class_name || "—"}</TableCell>
                  <TableCell className="text-center text-slate-600">{student.section || "—"}</TableCell>
                  <TableCell className="text-slate-600">{student.parent_name || "—"}</TableCell>
                  <TableCell className="text-slate-700 font-mono text-sm">{student.parent_phone}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStudent(student.id)}
                      className="text-red-600 hover:text-red-900 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-slate-500 font-medium">
                  No student records found. Add students by clicking "Upload CSV"!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

      </div>

      {/* Upload Modal - ShadCN Dialog */}
      <Dialog open={openUpload} onOpenChange={setOpenUpload}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200">
          <form onSubmit={handleUploadSubmit}>
            <DialogHeader>
              <DialogTitle className="text-slate-800 text-lg font-bold">Upload Student Roster</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm">
                Select a CSV or Excel spreadsheet containing: name, class_name, section, roll_number, parent_name, and parent_phone.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50 hover:bg-slate-100/50 transition-colors duration-150">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer text-center flex flex-col items-center gap-2"
                >
                  <svg
                    className="h-10 w-10 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                    {selectedFile ? selectedFile.name : "Click to select roster spreadsheet"}
                  </span>
                  <span className="text-xs text-slate-400">
                    Supports .csv, .xlsx, or .xls files
                  </span>
                </label>
              </div>
            </div>

            <DialogFooter className="sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenUpload(false);
                  setSelectedFile(null);
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading || !selectedFile}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-all duration-150"
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
