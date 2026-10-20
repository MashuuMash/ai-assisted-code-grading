import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { TestCase } from '../types';

const example = 'from solution import add\n\ndef test_add():\n    assert add(1, 2) == 3\n';
const input = 'w-full rounded-lg border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2C46A]';

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
  return <section className="rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-5 space-y-3 text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
    <h2 className="font-bold text-lg text-[#4C4541] dark:text-[#FCF0DA]">Test cases ({tests.length})</h2>
    <p className="text-sm text-[#4C4541]/80 dark:text-[#FCF0DA]/80">Write pytest tests importing student functions from <code>solution</code>. Public tests contribute to Correctness; hidden tests contribute to Robustness. After changing tests, rerun grading for affected submissions.</p>
    {error && <p role="alert" className="text-rose-700 dark:text-rose-400 font-semibold">{error}</p>}
    {notice && <p role="status" className="text-emerald-700 dark:text-emerald-400 font-semibold">{notice}</p>}
    <ul className="divide-y divide-[#AEAC78]/30">
      {tests.map((test) => <li key={test.id} className="flex items-center justify-between gap-3 py-2 text-[#4C4541] dark:text-[#FCF0DA]" data-testid="test-row">
        <span><strong className="text-[#4C4541] dark:text-[#FCF0DA]">{test.name}</strong> <span className="text-xs text-[#AEAC78]">({test.visibility})</span></span>
        <div className="flex gap-3">
          <button type="button" disabled={busy} className="text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#F2C46A] font-semibold cursor-pointer" onClick={() => {
            setId(test.id); setName(test.name); setVisibility(test.visibility); setContent(test.content || ''); setNotice(''); setError('');
          }}>Edit test</button>
          <button type="button" disabled={busy} className="text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold cursor-pointer" onClick={async () => {
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
    <form className="space-y-3 border-t border-[#AEAC78]/30 pt-3" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(''); setNotice('');
      try {
        const saved = await api.tests.save(base, { name: name.trim(), visibility, content }, id);
        setTests((previous) => id === undefined ? [...previous, saved] : previous.map((item) => item.id === id ? saved : item));
        reset(); setNotice('Test saved.');
      } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
      finally { setBusy(false); }
    }}>
      <h3 className="font-semibold text-sm text-[#4C4541] dark:text-[#FCF0DA]">{id === undefined ? 'Add test' : 'Edit selected test'}</h3>
      <label className="block font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Test name<input className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} /></label>
      <label className="block font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Visibility<select aria-label="Visibility" className={input} value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'hidden')}>
        <option value="public">Public</option><option value="hidden">Hidden</option>
      </select></label>
      <label className="block font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Python test code<textarea aria-label="Python test code" className={`${input} font-mono`} rows={7} value={content} onChange={(e) => setContent(e.target.value)} required spellCheck={false} /></label>
      <div className="flex gap-3">
        <button disabled={busy || !name.trim() || !content.trim()} className="rounded-lg bg-[#F2C46A] hover:bg-[#F2C46A]/90 px-4 py-2 text-[#4C4541] font-bold border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 transition-colors cursor-pointer">{busy ? 'Saving...' : 'Save test'}</button>
        {id !== undefined && <button type="button" disabled={busy} className="rounded-lg border border-[#AEAC78]/60 hover:bg-[#FCF0DA] px-4 py-2 text-[#4C4541] dark:text-[#FCF0DA] font-medium cursor-pointer" onClick={reset}>Cancel editing</button>}
      </div>
    </form>
  </section>;
}
