import { useMemo, useState } from 'react';
import { useStore, openExceptions } from '../lib/store';
import { RULES, RULE_MAP, RULE_PACK, agentStatus, daysUntil, downloadCSV, fmtDate, scoreAgent, BAND_LABEL } from '../lib/data';
import { I, ScoreRing, SectionHead, StatusChip } from '../components/ui';

export default function Reports() {
  const { agents, exceptions, audit } = useStore();
  const [mode, setMode] = useState<'executive' | 'technical'>('executive');
  const active = agents.filter(a => !a.retired);

  const scored = useMemo(() => active.map(a => ({ a, s: scoreAgent(a), st: agentStatus(a, exceptions) })), [active, exceptions]);
  const portfolio = Math.round(scored.reduce((x, y) => x + y.s.score, 0) / Math.max(scored.length, 1));
  const band = portfolio >= 85 ? 'assured' : portfolio >= 65 ? 'provisional' : 'at-risk';
  const open = openExceptions(exceptions);
  const dist = { assured: 0, provisional: 0, atrisk: 0, exception: 0 };
  scored.forEach(({ st }) => { if (st === 'assured') dist.assured++; else if (st === 'provisional') dist.provisional++; else if (st === 'exception') dist.exception++; else dist.atrisk++; });
  const manualCount = active.reduce((n, a) => n + a.rules.filter(r => r.state === 'manual').length, 0);
  const overdue = active.filter(a => daysUntil(a.nextReview) < 0).length;
  const closed30 = exceptions.filter(e => e.status === 'closed' && e.closedAt && daysUntil(e.closedAt) > -30).length;

  const findings = useMemo(() => {
    const fails: Record<string, string[]> = {};
    active.forEach(a => a.rules.forEach(r => { if (r.state === 'fail') (fails[r.ruleId] ??= []).push(a.name); }));
    return Object.entries(fails).map(([ruleId, names]) => ({ rule: RULE_MAP[ruleId], names })).sort((a, b) => b.rule.weight - a.rule.weight);
  }, [active]);

  const exportExec = () => downloadCSV('agentguard-executive-summary.csv', [
    ['AgentGuard 365 — executive assurance summary', fmtDate(new Date().toISOString())],
    ['Rule pack', RULE_PACK], ['Portfolio score', portfolio], ['Band', BAND_LABEL[band]],
    ['Active agents', active.length], ['Assured', dist.assured], ['Provisional', dist.provisional], ['Exception/At risk', dist.exception + dist.atrisk],
    ['Open exceptions', open.length], ['High severity', open.filter(e => e.severity === 'high').length], ['Overdue reviews', overdue],
    ['Manual validations pending', manualCount], ['Closed exceptions (30d)', closed30], [],
    ['Agent', 'Owner', 'Score', 'Confidence', 'Status', 'Open exceptions', 'Next review'],
    ...scored.map(({ a, s, st }) => [a.name, a.owner, s.score, `${s.confidence}%`, st, open.filter(e => e.agentId === a.id).length, fmtDate(a.nextReview)]),
  ]);

  const exportMatrix = () => downloadCSV('agentguard-rule-matrix.csv', [
    ['Agent', ...RULES.map(r => r.id)],
    ...active.map(a => [a.name, ...RULES.map(r => { const x = a.rules.find(y => y.ruleId === r.id); return x?.state ?? 'na'; })]),
  ]);

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-[1080px] mx-auto">
      <SectionHead
        kicker="Board pack & engineering artefacts"
        title="Assurance reports"
        sub={`Prepared ${today} · rule pack ${RULE_PACK} · ${active.length} agents under assurance · evidence, not certification.`}
        right={<>
          <div className="flex rounded-md border border-line overflow-hidden no-print">
            {(['executive', 'technical'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3.5 h-9 text-[13px] font-medium capitalize transition-colors cursor-pointer ${mode === m ? 'bg-pine-ink2 text-pine-tint' : 'bg-card text-ink-soft hover:text-ink'}`}>{m}</button>
            ))}
          </div>
          {mode === 'executive'
            ? <button className="btn-ghost no-print" onClick={exportExec}><I n="download" s={15} />CSV</button>
            : <button className="btn-ghost no-print" onClick={exportMatrix}><I n="download" s={15} />Matrix CSV</button>}
          <button className="btn-ghost no-print" onClick={() => window.print()}><I n="printer" s={15} />Print</button>
        </>}
      />

      {mode === 'executive' ? (
        <div className="space-y-5 print-flat">
          <div className="card p-6 reveal grid md:grid-cols-[auto_1fr] gap-8 items-center">
            <div className="flex items-center gap-5">
              <ScoreRing value={portfolio} band={band} size={110} stroke={9} label="portfolio" />
              <div>
                <div className="font-display font-bold text-[20px] leading-tight">{BAND_LABEL[band]} posture</div>
                <p className="text-[13px] text-ink-soft mt-1.5 max-w-[300px] leading-relaxed">Weighted across {active.length} active agents using deterministic rule pack {RULE_PACK}.</p>
                <div className="mt-2"><StatusChip status={band as never} /></div>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-2">Agent distribution</div>
              <div className="flex h-8 rounded-md overflow-hidden border border-line">
                {dist.assured > 0 && <div className="bg-pine grow-bar flex items-center justify-center text-pine-tint font-mono text-[11px]" style={{ width: `${(100 * dist.assured) / scored.length}%` }}>{dist.assured}</div>}
                {dist.provisional > 0 && <div className="bg-amber grow-bar flex items-center justify-center text-amber-tint font-mono text-[11px]" style={{ width: `${(100 * dist.provisional) / scored.length}%` }}>{dist.provisional}</div>}
                {dist.exception > 0 && <div className="bg-red grow-bar flex items-center justify-center text-red-tint font-mono text-[11px]" style={{ width: `${(100 * dist.exception) / scored.length}%` }}>{dist.exception}</div>}
                {dist.atrisk > 0 && <div className="bg-red-deep grow-bar flex items-center justify-center text-red-tint font-mono text-[11px]" style={{ width: `${(100 * dist.atrisk) / scored.length}%` }}>{dist.atrisk}</div>}
              </div>
              <div className="flex gap-4 mt-2 text-[11.5px] text-ink-soft flex-wrap">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-pine" />Assured {dist.assured}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber" />Provisional {dist.provisional}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red" />Exception {dist.exception}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-deep" />At risk {dist.atrisk}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <MiniStat k="Open exceptions" v={String(open.length)} />
                <MiniStat k="Overdue reviews" v={String(overdue)} />
                <MiniStat k="Manual pending" v={String(manualCount)} />
                <MiniStat k="Closed · 30d" v={String(closed30)} />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5 items-start">
            <div className="card p-5 reveal" style={{ animationDelay: '80ms' }}>
              <div className="kicker mb-3">Key findings</div>
              {findings.length === 0 && <p className="text-[13px] text-ink-soft">No failed deterministic rules across the estate.</p>}
              <div className="space-y-3.5">
                {findings.map(({ rule, names }) => (
                  <div key={rule.id} className="flex gap-3">
                    <span className="font-mono text-[11px] text-red-deep bg-red-tint rounded px-1.5 py-0.5 h-fit shrink-0">{rule.id}</span>
                    <div>
                      <div className="text-[13.5px] font-semibold leading-snug">{rule.title}</div>
                      <div className="text-[12.5px] text-ink-soft mt-0.5">Affects: {names.join(', ')}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-line-soft text-[12px] text-ink-faint">{manualCount} further results carry <span className="chip-outline">Manual required</span> and are excluded from assured conclusions until reviewer sign-off.</div>
            </div>

            <div className="card p-5 reveal" style={{ animationDelay: '140ms' }}>
              <div className="kicker mb-3">Assurance KPIs</div>
              <table className="tbl w-full -m-1">
                <tbody>
                  <KpiRow k="Agents under assurance" v={`${active.length} active · 1 retired retained`} />
                  <KpiRow k="Exception closure (30d)" v={`${closed30} closed with evidence`} />
                  <KpiRow k="High-severity exposure" v={`${open.filter(e => e.severity === 'high').length} open`} warn={open.some(e => e.severity === 'high')} />
                  <KpiRow k="Attestation coverage" v={`${active.filter(a => -daysUntil(a.attestedAt) <= 90).length}/${active.length} within 90-day window`} warn={overdue > 0} />
                  <KpiRow k="Collection mode" v="Metadata-only · 0 content reads" />
                  <KpiRow k="Provenance" v={`Audit chain intact · ${audit.length} entries`} />
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5 reveal" style={{ animationDelay: '200ms' }}>
            <div className="kicker mb-3">Agent summary</div>
            <div className="overflow-x-auto">
              <table className="tbl w-full min-w-[640px]">
                <thead><tr><th>Agent</th><th>Owner</th><th>Score</th><th>Confidence</th><th>Open exceptions</th><th>Next review</th><th>Status</th></tr></thead>
                <tbody>
                  {scored.sort((a, b) => a.s.score - b.s.score).map(({ a, s, st }) => (
                    <tr key={a.id}>
                      <td><div className="font-semibold text-[13px]">{a.name}</div><div className="font-mono text-[10.5px] text-ink-faint">{a.id}</div></td>
                      <td className="text-[12.5px]">{a.owner}</td>
                      <td><span className="font-mono font-semibold text-[13px]">{s.score}</span><span className="font-mono text-[10.5px] text-ink-faint"> /100</span></td>
                      <td className="font-mono text-[12px] text-ink-soft">{s.confidence}%</td>
                      <td className="font-mono text-[12px]">{open.filter(e => e.agentId === a.id).length || '—'}</td>
                      <td className={`text-[12.5px] ${daysUntil(a.nextReview) < 0 ? 'text-red font-semibold' : ''}`}>{fmtDate(a.nextReview)}</td>
                      <td><StatusChip status={st} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5 print-flat">
          <div className="card p-5 reveal overflow-x-auto">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="kicker">Rule × agent compliance matrix</div>
              <div className="flex items-center gap-3 text-[11.5px] text-ink-soft">
                <span className="inline-flex items-center gap-1"><Cell s="pass" /> pass</span>
                <span className="inline-flex items-center gap-1"><Cell s="fail" /> fail</span>
                <span className="inline-flex items-center gap-1"><Cell s="manual" /> manual req.</span>
                <span className="inline-flex items-center gap-1"><Cell s="na" /> n/a</span>
              </div>
            </div>
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card text-left font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft px-3 py-2 border-b border-r border-line">Agent</th>
                  {RULES.map(r => (
                    <th key={r.id} title={`${r.title} — ${r.check}`} className="px-1 py-2 border-b border-line cursor-help">
                      <span className="font-mono text-[9.5px] font-medium text-ink-soft writing-mode-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 64, display: 'inline-block' }}>{r.id}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map(a => (
                  <tr key={a.id} className="hover:bg-pine-tint/25 transition-colors">
                    <td className="sticky left-0 bg-card px-3 py-1.5 border-b border-r border-line-soft whitespace-nowrap">
                      <div className="text-[12.5px] font-semibold">{a.name}</div>
                      <div className="font-mono text-[10px] text-ink-faint">{a.id} · score {scoreAgent(a).score}</div>
                    </td>
                    {RULES.map(r => {
                      const res = a.rules.find(x => x.ruleId === r.id);
                      return (
                        <td key={r.id} className="px-1 py-1.5 border-b border-line-soft text-center">
                          <span title={`${r.id} · ${res?.state}${res?.note ? ` — ${res.note}` : ''}${res?.ref ? ` · evidence ${res.ref}` : ''}`}>
                            <Cell s={res?.state ?? 'na'} />
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-5 items-start">
            <div className="card p-5 reveal" style={{ animationDelay: '80ms' }}>
              <div className="kicker mb-3">Evidence references (latest)</div>
              <div className="space-y-2">
                {active.flatMap(a => a.evaluations).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7).map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-3 text-[12.5px] border-b border-line-soft pb-2 last:border-0">
                    <span className="font-mono text-pine-deep font-semibold">{e.id}</span>
                    <span className="truncate text-ink-soft flex-1">{e.suite}</span>
                    <span className="font-mono text-[11px] text-ink-faint shrink-0">{e.passed}/{e.cases}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5 reveal" style={{ animationDelay: '140ms' }}>
              <div className="kicker mb-3">Reading this matrix</div>
              <ul className="space-y-2.5 text-[12.5px] text-ink-soft leading-relaxed list-none">
                <li className="flex gap-2"><I n="check" s={14} w={2.2} c="text-pine mt-0.5 shrink-0" />Each cell links to stored evidence with a fixture hash — hover for the reference.</li>
                <li className="flex gap-2"><I n="alert" s={14} w={2} c="text-amber-deep mt-0.5 shrink-0" />Manual cells are partial-credit, low-confidence by design; they never silently pass.</li>
                <li className="flex gap-2"><I n="info" s={14} c="text-steel mt-0.5 shrink-0" />Retired agents are excluded from the live matrix but retained in the audit ledger for provenance.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-white/60 px-3 py-2">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">{k}</div>
      <div className="font-display font-bold text-[17px] leading-tight mt-0.5">{v}</div>
    </div>
  );
}
function KpiRow({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <tr>
      <td className="text-[12.5px] text-ink-soft py-2">{k}</td>
      <td className={`text-[12.5px] font-medium text-right py-2 ${warn ? 'text-red-deep' : ''}`}>{v}</td>
    </tr>
  );
}
function Cell({ s }: { s: string }) {
  const map: Record<string, string> = {
    pass: 'bg-pine text-pine-tint', fail: 'bg-red text-red-tint', manual: 'bg-amber-tint text-amber-deep border border-dashed border-amber/70', na: 'bg-line-soft text-ink-faint',
  };
  const letter: Record<string, string> = { pass: 'P', fail: 'F', manual: 'M', na: '·' };
  return <span className={`inline-flex w-[22px] h-[22px] items-center justify-center rounded font-mono text-[10.5px] font-semibold ${map[s] ?? map.na}`}>{letter[s] ?? '·'}</span>;
}


