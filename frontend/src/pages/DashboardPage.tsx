import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
  Download,
  Search,
  UploadCloud,
} from 'lucide-react';
import { api } from '../services/api';
import { Assignment, SubmissionListItem } from '../types';

interface DashboardPageProps {
  assignment: Assignment;
  submissions: SubmissionListItem[];
  onSelectSubmission: (submissionId: string) => void;
  onRefreshSubmissions: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  assignment,
  submissions,
  onSelectSubmission,
  onRefreshSubmissions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const summary = await api.uploadBatchSubmissions(assignment.id, file);
      setUploadSuccess(`Ingested ${summary.created_count} submissions (${summary.total_found} found in ZIP archive).`);
      onRefreshSubmissions();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload batch archive');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filtered = submissions.filter((s) => {
    const matchesSearch =
      s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.student_identifier.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'REQUIRES_REVIEW') return matchesSearch && s.status === 'REQUIRES_REVIEW';
    if (statusFilter === 'APPROVED') return matchesSearch && s.status === 'APPROVED';
    if (statusFilter === 'FLAGGED') return matchesSearch && (s.status === 'FLAGGED' || s.ai_risk_tier === 'HIGH');
    return matchesSearch;
  });

  // Calculate metrics
  const totalCount = submissions.length;
  const approvedCount = submissions.filter((s) => s.status === 'APPROVED').length;
  const flaggedCount = submissions.filter((s) => s.status === 'FLAGGED' || s.ai_risk_tier === 'HIGH').length;
  const reviewedScores = submissions.filter((s) => s.final_grade !== undefined).map((s) => s.final_grade || 0);
  const avgScore =
    reviewedScores.length > 0
      ? (reviewedScores.reduce((a, b) => a + b, 0) / reviewedScores.length).toFixed(2)
      : '0.00';

  return (
    <div className="space-y-6">
      {/* Top Banner / Assessment Metadata */}
      <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-slate-900">{assignment.title}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-primary font-mono font-medium border border-blue-200">
              Max {assignment.max_score} pts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {assignment.description || 'Evaluate submissions against test suites, Ruff linter diagnostics, and AST metrics.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".zip"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-700 transition-colors shadow-2xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isUploading ? 'Ingesting ZIP...' : 'Upload Submissions ZIP'}</span>
          </button>

          <a
            href={api.getExportGradesUrl(assignment.id)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Submissions</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{totalCount}</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Approved / Reviewed</div>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {approvedCount} <span className="text-xs text-slate-400 font-normal">/ {totalCount}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Integrity / Flagged</div>
          <div className="text-xl font-bold text-amber-600 mt-1 font-mono">{flaggedCount}</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Cohort Mean Score</div>
          <div className="text-xl font-bold text-primary mt-1 font-mono">{avgScore}</div>
        </div>
      </div>

      {/* Submissions Table & Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded shadow-2xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search by student name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none w-64"
              />
            </div>

            <div className="flex items-center space-x-1 bg-slate-200/60 p-0.5 rounded text-xs">
              {(['ALL', 'REQUIRES_REVIEW', 'APPROVED', 'FLAGGED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    statusFilter === tab ? 'bg-white font-medium text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing {filtered.length} of {submissions.length} submissions
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-medium select-none">
                <th className="px-4 py-2.5">Student ID</th>
                <th className="px-4 py-2.5">Student Name</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Tests</th>
                <th className="px-4 py-2.5">Automated</th>
                <th className="px-4 py-2.5">Lecturer Final</th>
                <th className="px-4 py-2.5">AI Heuristic</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 font-mono">
                    No submissions found matching criteria. Upload a batch ZIP archive above.
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-slate-700 font-medium">
                      {sub.student_identifier}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 font-medium">
                      {sub.student_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                        sub.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : sub.status === 'FLAGGED'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">
                      {sub.execution_status === 'SUCCESS' ? (
                        <span className="text-emerald-600 font-medium">PASSED</span>
                      ) : sub.execution_status === 'TIMEOUT' ? (
                        <span className="text-amber-600 font-medium">TIMEOUT</span>
                      ) : (
                        <span className="text-red-600 font-medium">FAILED</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">
                      {sub.automated_grade !== undefined ? sub.automated_grade : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                      {sub.final_grade !== undefined ? sub.final_grade : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        sub.ai_risk_tier === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : sub.ai_risk_tier === 'MEDIUM'
                          ? 'bg-slate-100 text-slate-700'
                          : 'text-slate-400'
                      }`}>
                        {sub.ai_risk_tier || 'LOW'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => onSelectSubmission(sub.id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-primary hover:text-primary-700 font-medium bg-blue-50/60 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                      >
                        <span>Evaluate</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
