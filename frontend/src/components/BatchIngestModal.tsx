import React, { useState } from 'react';
import {
  AlertCircle,
  Archive,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { BatchIngestResponse } from '../types';

interface BatchIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  classId: number;
  assignmentId: number;
  onIngestSuccess: () => void;
}

export const BatchIngestModal: React.FC<BatchIngestModalProps> = ({
  isOpen,
  onClose,
  courseId,
  classId,
  assignmentId,
  onIngestSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchIngestResponse | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a .zip archive.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const res = await api.batch.uploadZip(courseId, classId, assignmentId, selectedFile);
      setResult(res);
      onIngestSuccess();
    } catch (err: any) {
      setError(err.message || 'Batch ingestion failed. Check archive format.');
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA] rounded-2xl border border-[#AEAC78]/40 shadow-2xl max-w-xl w-full p-6 text-xs flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#AEAC78]/30">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#F2C46A] border border-[#AEAC78]/30 rounded-lg">
              <Archive className="w-5 h-5 text-[#F2C46A]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                Batch Ingest Student Submissions
              </h3>
              <p className="text-[#AEAC78] text-[11px]">
                Safe ZIP extraction from Moodle, Classroom, Canvas, or flat archives
              </p>
            </div>
          </div>
          <button
            onClick={resetModal}
            className="text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {/* File Picker */}
          {!result && (
            <div className="border-2 border-dashed border-[#AEAC78]/60 hover:border-[#F2C46A] rounded-xl p-6 text-center transition-colors bg-[#FCF0DA]/30 dark:bg-[#2C2623]/60">
              <input
                type="file"
                id="batch-file-input"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="batch-file-input"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <UploadCloud className="w-10 h-10 text-[#F2C46A] mb-2" />
                <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA] text-xs">
                  {selectedFile ? selectedFile.name : 'Select LMS Batch Archive (.zip)'}
                </span>
                <span className="text-[11px] text-[#AEAC78] mt-1">
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Safe Zip Slip protected extraction (up to 50MB)'}
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-[#FCF0DA] dark:bg-[#2C2623] border border-[#AEAC78]/40 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[#4C4541] dark:text-[#FCF0DA]">Found</span>
                  <div className="text-base font-black text-[#4C4541] dark:text-[#FCF0DA] font-mono mt-0.5">
                    {result.total_found}
                  </div>
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Submissions</span>
                  <div className="text-base font-black text-emerald-800 dark:text-emerald-200 font-mono mt-0.5">
                    {result.imported_count}
                  </div>
                </div>
                <div className="p-2.5 bg-[#FCF0DA]/40 dark:bg-[#2C2623]/40 border border-[#AEAC78]/40 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[#AEAC78]">Failed</span>
                  <div className="text-base font-black text-[#4C4541] dark:text-[#FCF0DA] font-mono mt-0.5">
                    {result.failed_count}
                  </div>
                </div>
              </div>

              {/* Roster extraction list */}
              <div className="border border-[#AEAC78]/40 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] font-bold border-b border-[#AEAC78]/30">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left">Student ID</th>
                      <th className="px-2.5 py-1.5 text-left">Filename</th>
                      <th className="px-2.5 py-1.5 text-center">Grading</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#AEAC78]/20 font-mono">
                    {result.submissions.map((r) => (
                      <tr key={r.submission_id} className="hover:bg-[#FCF0DA]/30 dark:hover:bg-[#2C2623]/40 transition-colors">
                        <td className="px-2.5 py-1 text-[#4C4541] dark:text-[#FCF0DA] font-semibold">{r.student_identifier}</td>
                        <td className="px-2.5 py-1 text-[#AEAC78] truncate max-w-[200px]">{r.filename}</td>
                        <td className="px-2.5 py-1 text-center">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200"
                          >
                            {r.job_id ? 'Queued' : 'Imported'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.errors.length > 0 && (
                <div role="alert" className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-800 dark:text-amber-200">
                  <p className="font-semibold">Files that could not be imported</p>
                  <ul className="mt-1 list-disc pl-4">
                    {result.errors.map((message, index) => <li key={index}>{message}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#AEAC78]/30 flex items-center justify-end space-x-2">
          <button
            onClick={resetModal}
            className="px-3 py-1.5 border border-[#AEAC78]/60 hover:bg-[#FCF0DA]/40 dark:hover:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] rounded-lg font-medium transition-colors"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="px-4 py-1.5 bg-[#F2C46A] hover:bg-[#e0b45b] disabled:opacity-50 text-[#4C4541] rounded-lg font-bold inline-flex items-center space-x-1.5 shadow-sm transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{uploading ? 'Extracting...' : 'Upload & Ingest'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
