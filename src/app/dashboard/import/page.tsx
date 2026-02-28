"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportResult } from "@/types";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".dat")) {
      setFile(droppedFile);
      setResult(null);
      setError("");
    } else {
      setError("Please upload a .dat file");
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setResult(null);
        setError("");
      }
    },
    []
  );

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data: ImportResult = await res.json();
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Data</h1>
        <p className="text-slate-500 mt-1">
          Upload attendance log files (.dat) from your time clock device.
          Duplicate records are automatically skipped and manually entered punches are always preserved.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".dat"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload
            className={cn(
              "w-12 h-12 mx-auto mb-4",
              dragActive ? "text-blue-500" : "text-slate-400"
            )}
          />
          <p className="text-slate-700 font-medium">
            Drop your .dat file here, or click to browse
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Supports ATTLOG.dat format from ZKTeco time clocks
          </p>
        </div>

        {file && (
          <div className="mt-4 bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileUp className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {file.name}
                </p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload & Import
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Import Complete
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {result.imported}
              </p>
              <p className="text-xs text-blue-600 mt-1">New Punches</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">
                {result.skipped}
              </p>
              <p className="text-xs text-slate-500 mt-1">Duplicates Skipped</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {result.manualPunchesPreserved}
              </p>
              <p className="text-xs text-green-600 mt-1">Manual Punches Safe</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">
                {result.newEmployees}
              </p>
              <p className="text-xs text-purple-600 mt-1">New Employees</p>
            </div>
          </div>

          {result.manualPunchesPreserved > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-green-800 text-sm">
                <span className="font-medium">{result.manualPunchesPreserved} manually entered punch{result.manualPunchesPreserved !== 1 ? "es" : ""}</span> {result.manualPunchesPreserved !== 1 ? "were" : "was"} preserved and not affected by this import.
              </p>
            </div>
          )}

          {result.newEmployees > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <Users className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-800 text-sm font-medium">
                  New employees were created
                </p>
                <p className="text-amber-600 text-sm mt-0.5">
                  Set up their names and pay rates in the employee settings.
                </p>
                <Link
                  href="/dashboard/employees"
                  className="inline-block mt-2 text-sm font-medium text-amber-700 hover:text-amber-800 underline"
                >
                  Configure Employees
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
