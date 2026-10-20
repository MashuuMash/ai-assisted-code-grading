import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { GradingJob } from '../types';

export function GradingJobPanel({ base, submissionId, onFinished }: {
  base: string; submissionId: number; onFinished: () => Promise<void>;
}) {
  const [jobs, setJobs] = useState<GradingJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const callback = useRef(onFinished);
  useEffect(() => { callback.current = onFinished; }, [onFinished]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previousSignature: string | undefined;
    const poll = async () => {
      try {
        const list = await api.jobs.list(base, submissionId);
        if (cancelled) return;
        const latest = list[0];
        if (latest && !['queued', 'running'].includes(latest.status)) list[0] = await api.jobs.get(base, submissionId, latest.id);
        if (cancelled) return;
        setJobs(list); setError(''); setLoaded(true);
        const signature = latest ? `${latest.id}:${latest.status}` : '';
        if (previousSignature !== undefined && signature !== previousSignature && latest && !['queued', 'running'].includes(latest.status)) {
          await callback.current();
        }
        previousSignature = signature;
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Cannot load grading jobs'); }
      finally { if (!cancelled) timer = setTimeout(() => void poll(), 2500); }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [base, submissionId]);
  const latest = jobs[0];
  const active = jobs.some((job) => ['queued', 'running'].includes(job.status));
  return (
    <section
      className="rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-3.5 text-xs shrink-0 text-[#4C4541] dark:text-[#FCF0DA] shadow-xs"
      aria-label="Grading job status"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[#4C4541] dark:text-[#FCF0DA]">
          <strong className="text-[#4C4541] dark:text-[#FCF0DA]">Grading status: </strong>
          <span data-testid="job-status" className="font-bold text-[#4C4541] dark:text-[#F2C46A]">
            {latest?.status || (loaded ? 'Not queued' : 'Loading...')}
          </span>
          {latest?.status === 'completed' && (
            <span className="text-[#4C4541] dark:text-[#FCF0DA]"> · {latest.passed_tests}/{latest.total_tests} tests passed</span>
          )}
        </div>
        <button
          className="rounded-lg bg-[#F2C46A] hover:bg-[#F2C46A]/90 text-[#4C4541] font-bold px-3.5 py-1.5 border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
          disabled={busy || active || !loaded}
          onClick={async () => {
            if (latest && !window.confirm('Rerun tests and recalculate suggested grades? Review and confirm the grade again after completion.')) return;
            setBusy(true); setError('');
            try {
              const job = await api.jobs.queue(base, submissionId);
              setJobs((previous) => [job, ...previous]);
              await callback.current();
            } catch (err) { setError(err instanceof Error ? err.message : 'Cannot queue grading'); }
            finally { setBusy(false); }
          }}
        >
          {busy ? 'Queuing...' : latest ? 'Rerun grading' : 'Run grading'}
        </button>
      </div>
      {(busy || active) && (
        <div className="mt-3 p-2.5 rounded-lg bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#F2C46A]/50 space-y-2 animate-scale-pop">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#4C4541] dark:text-[#F2C46A] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F2C46A] animate-ping" />
              Docker Container Executing in Isolated Sandbox...
            </span>
            <span className="text-[#6B625B] dark:text-[#AEAC78] font-semibold">cgroups: 256MB / 1 vCPU</span>
          </div>
          <div className="w-full bg-[#FCF0DA] dark:bg-[#38322E] rounded-full h-1.5 overflow-hidden border border-[#AEAC78]/30">
            <div className="bg-[#F2C46A] h-1.5 rounded-full animate-scanline w-2/3" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#6B625B] dark:text-[#AEAC78] font-mono">
            <span>Stage 2/5: Pytest assertion suite running</span>
            <span>Network egress: disabled (--network none)</span>
          </div>
        </div>
      )}
      {latest?.failure_type && (
        <p className="mt-2 text-rose-700 dark:text-rose-400 font-medium">
          {latest.failure_type}: {latest.failure_information || (latest.status === 'timeout' ? 'Execution exceeded the time limit.' : 'Check test code and worker availability.')}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-rose-700 dark:text-rose-400 font-medium">{error}</p>}
      {latest && (
        <details className="mt-2 text-[#4C4541] dark:text-[#FCF0DA]">
          <summary className="cursor-pointer font-semibold text-[#4C4541] dark:text-[#FCF0DA] hover:text-[#AEAC78]">
            Results and grading history ({jobs.length})
          </summary>
          <div className="max-h-40 overflow-auto mt-2 space-y-1 text-[#4C4541] dark:text-[#FCF0DA]">
            {jobs.map((job) => (
              <p key={job.id} className="text-[#4C4541] dark:text-[#FCF0DA]">
                #{job.id} · {job.status} · {job.passed_tests}/{job.total_tests} · {new Date(job.created_at).toLocaleString()}
              </p>
            ))}
            {latest.results.map((result) => (
              <div key={result.id} className="text-[#4C4541] dark:text-[#FCF0DA]">
                <strong className="text-[#4C4541] dark:text-[#FCF0DA]">{result.test_name}: {result.outcome}</strong>
                {result.failure_detail && (
                  <pre className="whitespace-pre-wrap text-rose-700 dark:text-rose-400 font-mono text-[11px] mt-0.5">
                    {result.failure_detail}
                  </pre>
                )}
              </div>
            ))}
            {latest.runner_output && (
              <pre className="whitespace-pre-wrap bg-[#FCF0DA]/40 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] p-2 rounded border border-[#AEAC78]/30 font-mono text-[11px]">
                {latest.runner_output}
              </pre>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
