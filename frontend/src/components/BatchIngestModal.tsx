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
      setError('Please select a .zip archive or python source file.');
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 text-xs flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Batch Ingest Student Submissions
              </h3>
              <p className="text-slate-400 text-[11px]">
                Safe ZIP extraction from Moodle, Classroom, Canvas, or flat archives
              </p>
            </div>
          </div>
          <button
            onClick={resetModal}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {/* File Picker */}
          {!result && (
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
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
                <UploadCloud className="w-10 h-10 text-indigo-500 mb-2" />
                <span className="font-bold text-slate-700 text-xs">
                  {selectedFile ? selectedFile.name : 'Select LMS Batch Archive (.zip)'}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Safe Zip Slip protected extraction (up to 50MB)'}
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-600">Extracted</span>
                  <div className="text-base font-black text-indigo-900 font-mono mt-0.5">
                    {result.total_files_extracted}
                  </div>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Submissions</span>
                  <div className="text-base font-black text-emerald-900 font-mono mt-0.5">
                    {result.submissions_created}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Skipped</span>
                  <div className="text-base font-black text-slate-700 font-mono mt-0.5">
                    {result.skipped_files}
                  </div>
                </div>
              </div>

              {/* Roster extraction list */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left">Student ID</th>
                      <th className="px-2.5 py-1.5 text-left">Filename</th>
                      <th className="px-2.5 py-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {result.results.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1 text-slate-800 font-semibold">{r.student_id}</td>
                        <td className="px-2.5 py-1 text-slate-500 truncate max-w-[200px]">{r.filename}</td>
                        <td className="px-2.5 py-1 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'created'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            onClick={resetModal}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold inline-flex items-center space-x-1.5 shadow-sm"
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
