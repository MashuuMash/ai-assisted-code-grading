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
  return <section className="rounded-xl border bg-white p-3 text-xs shrink-0" aria-label="Grading job status">
    <div className="flex items-center justify-between gap-2">
      <div><strong>Grading status: </strong><span data-testid="job-status">{latest?.status || (loaded ? 'Not queued' : 'Loading...')}</span>
        {latest?.status === 'completed' && <span> · {latest.passed_tests}/{latest.total_tests} tests passed</span>}
      </div>
      <button className="rounded bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50" disabled={busy || active || !loaded} onClick={async () => {
        if (latest && !window.confirm('Rerun tests and recalculate suggested grades? Review and confirm the grade again after completion.')) return;
        setBusy(true); setError('');
        try {
          const job = await api.jobs.queue(base, submissionId);
          setJobs((previous) => [job, ...previous]);
          await callback.current();
        } catch (err) { setError(err instanceof Error ? err.message : 'Cannot queue grading'); }
        finally { setBusy(false); }
      }}>{busy ? 'Queuing...' : latest ? 'Rerun grading' : 'Run grading'}</button>
    </div>
    {latest?.failure_type && <p className="mt-2 text-rose-700">{latest.failure_type}: {latest.failure_information || (latest.status === 'timeout' ? 'Execution exceeded the time limit.' : 'Check test code and worker availability.')}</p>}
    {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
    {latest && <details className="mt-2">
      <summary className="cursor-pointer">Results and grading history ({jobs.length})</summary>
      <div className="max-h-40 overflow-auto mt-2 space-y-1">
        {jobs.map((job) => <p key={job.id}>#{job.id} · {job.status} · {job.passed_tests}/{job.total_tests} · {new Date(job.created_at).toLocaleString()}</p>)}
        {latest.results.map((result) => <div key={result.id}><strong>{result.test_name}: {result.outcome}</strong>{result.failure_detail && <pre className="whitespace-pre-wrap text-rose-700">{result.failure_detail}</pre>}</div>)}
        {latest.runner_output && <pre className="whitespace-pre-wrap">{latest.runner_output}</pre>}
      </div>
    </details>}
  </section>;
}
