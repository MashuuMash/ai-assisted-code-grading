import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { TestCase } from '../types';

const example = 'from solution import add\n\ndef test_add():\n    assert add(1, 2) == 3\n';
const input = 'w-full rounded border border-slate-300 p-2 text-sm';

export function TestCaseManager({ base }: { base: string }) {
  const [tests, setTests] = useState<TestCase[]>([]);
  const [id, setId] = useState<number | undefined>();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'hidden'>('public');
  const [content, setContent] = useState(example);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    api.tests.list(base).then((items) => { if (!cancelled) setTests(items); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [base]);
  const reset = () => { setId(undefined); setName(''); setVisibility('public'); setContent(example); };
  return <section className="rounded-xl border bg-white p-5 space-y-3">
    <h2 className="font-bold text-lg">Test cases ({tests.length})</h2>
    <p className="text-sm text-slate-600">Write pytest tests importing student functions from <code>solution</code>. Public tests contribute to Correctness; hidden tests contribute to Robustness. After changing tests, rerun grading for affected submissions.</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {notice && <p role="status" className="text-emerald-700">{notice}</p>}
    <ul className="divide-y">
      {tests.map((test) => <li key={test.id} className="flex items-center justify-between gap-3 py-2" data-testid="test-row">
        <span>{test.name} <span className="text-xs text-slate-500">({test.visibility})</span></span>
        <div className="flex gap-3">
          <button type="button" disabled={busy} className="text-indigo-700" onClick={() => {
            setId(test.id); setName(test.name); setVisibility(test.visibility); setContent(test.content || ''); setNotice(''); setError('');
          }}>Edit test</button>
          <button type="button" disabled={busy} className="text-rose-700" onClick={async () => {
            if (!window.confirm(`Delete test "${test.name}"?`)) return;
            setBusy(true); setError(''); setNotice('');
            try {
              await api.tests.remove(base, test.id);
              setTests((previous) => previous.filter((item) => item.id !== test.id));
              if (id === test.id) reset();
              setNotice('Test deleted.');
            } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); }
            finally { setBusy(false); }
          }}>Delete test</button>
        </div>
      </li>)}
    </ul>
    <form className="space-y-3 border-t pt-3" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(''); setNotice('');
      try {
        const saved = await api.tests.save(base, { name: name.trim(), visibility, content }, id);
        setTests((previous) => id === undefined ? [...previous, saved] : previous.map((item) => item.id === id ? saved : item));
        reset(); setNotice('Test saved.');
      } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
      finally { setBusy(false); }
    }}>
      <h3 className="font-semibold">{id === undefined ? 'Add test' : 'Edit selected test'}</h3>
      <label className="block">Test name<input className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} /></label>
      <label className="block">Visibility<select aria-label="Visibility" className={input} value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'hidden')}>
        <option value="public">Public</option><option value="hidden">Hidden</option>
      </select></label>
      <label className="block">Python test code<textarea aria-label="Python test code" className={`${input} font-mono`} rows={7} value={content} onChange={(e) => setContent(e.target.value)} required spellCheck={false} /></label>
      <div className="flex gap-3">
        <button disabled={busy || !name.trim() || !content.trim()} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save test'}</button>
        {id !== undefined && <button type="button" disabled={busy} onClick={reset}>Cancel editing</button>}
      </div>
    </form>
  </section>;
}
