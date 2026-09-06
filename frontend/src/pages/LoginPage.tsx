import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Terminal } from 'lucide-react';
import { api } from '../services/api';
import { Lecturer } from '../types';

interface LoginPageProps {
  onLoginSuccess: (token: string, lecturer: Lecturer) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('dr.smith@university.edu');
  const [password, setPassword] = useState('strongPassword123!');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Try login first
      try {
        const res = await api.login(email, password);
        onLoginSuccess(res.access_token, res.lecturer);
        return;
      } catch (loginErr) {
        // If login fails (e.g. freshly seeded local db), auto-register demo user
        const regRes = await api.register(email, password, 'Dr. Alan Smith');
        onLoginSuccess(regRes.access_token, regRes.lecturer);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-primary-50 border border-primary-200 text-primary">
            <Terminal className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            PyGrade AI — Lecturer Portal
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Academic code grading, AST complexity, similarity detection, and grounded AI evaluation.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Lecturer Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              placeholder="lecturer@university.edu"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-primary text-white rounded text-xs font-semibold hover:bg-primary-700 transition-colors shadow-2xs flex items-center justify-center space-x-1.5"
          >
            <span>{isLoading ? 'Signing In...' : 'Sign In to Portal'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-slate-400 font-mono">
          Single-sign on & Local Auth • Human-in-the-Loop Protocol
        </div>
      </div>
    </div>
  );
};
