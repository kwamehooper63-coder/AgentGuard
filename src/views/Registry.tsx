import { useMemo, useState } from 'react';
import { useStore, openExceptions, overdueAgents } from '../lib/store';
import type { AgentRecord } from '../lib/data';
import { RULES, agentStatus, daysUntil, fmtDate, scoreAgent, ago, downloadCSV } from '../lib/data';
import { I, ScoreRing, Spark, StatusChip, Modal, Field, Initials, SectionHead } from '../components/ui';

export default function Registry() {
  const { agents, exceptions, history, lastSweepAt, openAgent, sendReminder, registerAgent, scanning } = useStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFirst, setRiskFirst] = useState(true);
  const [regOpen, setRegOpen] = useState(false);

  const active = agents.filter(a => !a.retired);
  const scored = useMemo(() => active.map(a => ({ a, s: scoreAgent(a), st: agentStatus(a, exceptions) })), [active, exceptions]);
  const portfolio = Math.round(scored.reduce((x, y) => x + y.s.score, 0) / Math.max(scored.length, 1));
  const band = portfolio >= 85 ? 'assured' : portfolio >= 65 ? 'provisional' : 'at-risk';
  const open = openExceptions(exceptions);
  const overdue = overdueAgents(agents);
  const dueSoon = active.filter(a => { const d = daysUntil(a.nextReview); return d >= 0 && d <= 14; });
  const manualFlags = active.reduce((n, a) => n + a.rules.filter(r => r.state === 'manual').length, 0);

  const rows = useMemo(() => {
    let list = scored;
    if (statusFilter !== 'all') list = list.filter(x => x.st === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(x => x.a.name.toLowerCase().includes(q) || x.a.owner.toLowerCase().includes(q) || x.a.id.toLowerCase().includes(q));
    }
    return [...list].sort((x, y) => riskFirst ? x.s.score - y.s.score : y.s.score - x.s.score);
  }, [scored, statusFilter, query, riskFirst]);

  const coverage = useMemo(() => {
    let auto = 0, att = 0, man = 0;
    active.forEach(a => a.rules.forEach(r => {
      if (r.state === 'na') return;
      const rule = RULES.find(x => x.id === r.ruleId)!;
      if (rule.detection === 'automated') auto++; else if (rule.detection === 'attestation') att++; else man++;
    }));
    const t = auto + att + man || 1;
    return { auto: Math.round(100 * auto / t), att: Math.round(100 * att / t), man: Math.round(100 * man / t) };
  }, [active]);

  const queue = [...active].sort((a, b) => daysUntil(a.nextReview) - daysUntil(b.nextReview)).slice(0, 5);
  const filters: [string, string][] = [['all', 'All'], ['assured', 'Assured'], ['provisional', 'Provisional'], ['at-risk', 'At risk'], ['exception', 'Exception']];

  const exportRegister = () => downloadCSV('agentguard-register.csv', [
    ['ID', 'Agent', 'Owner', 'Status', 'Score', 'Confidence', 'Open exceptions', 'Next review', 'Last evaluated'],
    ...scored.map(({ a, s, st }) => [a.id, a.name, a.owner, st, s.score, `${s.confidence}%`, open.filter(e => e.agentId === a.id).length, fmtDate(a.nextReview), fmtDate(a.lastEvaluated)]),
  ]);

  return (
    <div className="p-6 max-w-[1240px] mx-auto">
      <SectionHead
        kicker="Application-level register"
        title="Agent Assurance Ledger"
        sub="Every SharePoint / Microsoft 365 agent under assurance — ownership, scope, permissions and evaluation evidence. Metadata-only collection; least privilege by default."
        right={<>
          <button className="btn-ghost no-print" onClick={exportRegister}><I n="download" s={15} />Export register</button>
          <button className="btn-primary no-print" onClick={() => setRegOpen(true)}><I n="plus" s={15} />Register agent</button>
        </>}
      />

      {/* portfolio posture */}
      <div className="card p-5 mb-5 reveal grid gap-6 lg:grid-cols-[auto_1fr_auto] items-center" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-4">
          <ScoreRing value={portfolio} band={band} size={92} stroke={8} label="portfolio" />
          <div>
            <div className="font-display font-bold text-lg leading-tight">Portfolio posture</div>
            <div className="text-[12.5px] text-ink-soft mt-1">{scored.length} active agents · weighted rule scoring</div>
            <div className="mt-2"><StatusChip status={band as never} /></div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Open exceptions" value={String(open.length)} sub={`${open.filter(e => e.severity === 'high').length} high severity`} tone={open.length ? 'red' : 'pine'} />
          <Stat label="Reviews overdue" value={String(overdue.length)} sub={`${dueSoon.length} due within 14d`} tone={overdue.length ? 'amber' : 'pine'} />
          <Stat label="Manual validations" value={String(manualFlags)} sub="awaiting reviewer sign-off" tone="amber" />
          <Stat label="Last sweep" value={ago(lastSweepAt)} sub={scanning ? 'sweep running…' : 'metadata-only · 0 content reads'} tone="steel" />
        </div>
        <div className="lg:border-l lg:border-line lg:pl-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft mb-1.5">Score trend · last {history.length} sweeps</div>
          <Spark points={history} />
          <div className="mt-2.5 space-y-1">
            <CovRow label="Automated" v={coverage.auto} cls="bg-pine" />
            <CovRow label="Attestation" v={coverage.att} cls="bg-steel" />
            <CovRow label="Manual" v={coverage.man} cls="bg-amber" />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px] items-start">
        {/* registry table */}
        <div className="card overflow-hidden reveal" style={{ animationDelay: '120ms' }}>
          <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-line">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"><I n="search" s={15} /></span>
              <input className="input pl-8" placeholder="Search agent, owner or ID…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              {filters.map(([id, label]) => (
                <button key={id} onClick={() => setStatusFilter(id)}
                  className={`px-2.5 h-8 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer border ${statusFilter === id ? 'bg-pine-ink2 text-pine-tint border-pine-ink' : 'bg-card text-ink-soft border-line hover:border-pine/50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setRiskFirst(v => !v)} className="btn-ghost h-8 text-[12.5px]" title="Toggle sort order">
              <I n="filter" s={13} />{riskFirst ? 'Risk first' : 'Score high→low'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead>
                <tr><th>Agent</th><th>Owner</th><th>Score</th><th>Exceptions</th><th>Next review</th><th>Last sweep</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rows.map(({ a, s, st }, i) => {
                  const d = daysUntil(a.nextReview);
                  const exCount = open.filter(e => e.agentId === a.id).length;
                  return (
                    <tr key={a.id} onClick={() => openAgent(a.id)} className="reveal" style={{ animationDelay: `${140 + i * 40}ms` }}>
                      <td>
                        <div className="font-semibold text-[13.5px]">{a.name}</div>
                        <div className="font-mono text-[11px] text-ink-faint">{a.id} · {a.env.split(' · ')[0]}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Initials name={a.owner} size={26} />
                          <div>
                            <div className="text-[13px] leading-tight">{a.owner}</div>
                            <div className="text-[11px] text-ink-faint leading-tight">{a.ownerRole}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <ScoreRing value={s.score} band={s.band} size={40} stroke={4.5} />
                          <div className="leading-tight">
                            <div className="font-mono text-[11px] text-ink-soft">{s.pass}✓ {s.fail}✗ {s.manual}⚠</div>
                            <div className="font-mono text-[10.5px] text-ink-faint">conf {s.confidence}%</div>
                          </div>
                        </div>
                      </td>
                      <td>{exCount ? <span className={`chip ${exCount && open.some(e => e.agentId === a.id && e.severity === 'high') ? 'bg-red-tint text-red-deep' : 'bg-amber-tint text-amber-deep'}`}>{exCount} open</span> : <span className="text-ink-faint text-[12px]">—</span>}</td>
                      <td>
                        <div className={`text-[13px] ${d < 0 ? 'text-red font-semibold' : d <= 14 ? 'text-amber-deep font-medium' : ''}`}>{fmtDate(a.nextReview)}</div>
                        <div className={`font-mono text-[10.5px] ${d < 0 ? 'text-red' : 'text-ink-faint'}`}>{d < 0 ? `${-d}d overdue` : `in ${d}d`}</div>
                      </td>
                      <td className="font-mono text-[11.5px] text-ink-soft">{ago(a.lastEvaluated)}</td>
                      <td><StatusChip status={st} /></td>
                      <td className="text-ink-faint"><I n="chevR" s={15} /></td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-ink-faint text-sm">No agents match the current filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-line flex items-center justify-between text-[11.5px] text-ink-faint">
            <span className="font-mono">Showing {rows.length} of {active.length} active · 1 retired held for provenance</span>
            <span>Scoring: deterministic rule pack v2026.02 — evidence, not certification</span>
          </div>
        </div>

        {/* review queue */}
        <div className="space-y-5">
          <div className="card p-4 reveal" style={{ animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="kicker">Review queue</div>
              <span className="chip-gray">{queue.length} upcoming</span>
            </div>
            <div className="space-y-3">
              {queue.map(a => {
                const d = daysUntil(a.nextReview);
                return (
                  <div key={a.id} className="group">
                    <button onClick={() => openAgent(a.id)} className="w-full text-left cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold group-hover:text-pine-deep transition-colors">{a.name}</span>
                        <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${d < 0 ? 'bg-red-tint text-red' : d <= 14 ? 'bg-amber-tint text-amber-deep' : 'bg-line-soft text-ink-soft'}`}>
                          {d < 0 ? `${-d}d over` : `${d}d`}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-ink-faint">{a.owner} · {fmtDate(a.nextReview)}</div>
                    </button>
                    <div className="mt-1.5 h-[5px] rounded-full bg-line-soft overflow-hidden">
                      <div className={`h-full grow-bar ${d < 0 ? 'bg-red' : d <= 14 ? 'bg-amber' : 'bg-pine'}`} style={{ width: `${Math.max(6, 100 - Math.min(d, 90))}%` }} />
                    </div>
                    {a.reminderSentAt
                      ? <div className="mt-1.5 text-[11px] text-pine-deep flex items-center gap-1"><I n="check" s={11} w={2.2} />Reminder sent {ago(a.reminderSentAt)}</div>
                      : <button onClick={() => sendReminder(a.id)} className="mt-1.5 text-[11.5px] font-medium text-steel hover:text-pine-deep inline-flex items-center gap-1 transition-colors cursor-pointer"><I n="send" s={12} />Send Teams reminder</button>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card p-4 reveal border-amber/40 bg-amber-tint/40" style={{ animationDelay: '240ms' }}>
            <div className="flex items-start gap-2.5">
              <span className="text-amber-deep mt-0.5"><I n="info" s={16} /></span>
              <div className="text-[12.5px] leading-relaxed text-ink">
                <span className="font-semibold">Manual validation required</span> on {manualFlags} rule results this cycle. Metadata cannot prove sharing boundaries or label reachability — reviewers close these out in the exception flow.
              </div>
            </div>
          </div>
        </div>
      </div>

      <RegisterModal open={regOpen} onClose={() => setRegOpen(false)} onRegister={registerAgent} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'pine' | 'amber' | 'red' | 'steel' }) {
  const cls = { pine: 'text-pine-deep', amber: 'text-amber-deep', red: 'text-red', steel: 'text-steel' }[tone];
  return (
    <div className="rounded-md border border-line-soft bg-white/60 px-3 py-2.5 transition-colors hover:border-line">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</div>
      <div className={`font-display font-bold text-[22px] leading-tight mt-0.5 ${cls}`}>{value}</div>
      <div className="text-[11px] text-ink-soft leading-tight mt-0.5">{sub}</div>
    </div>
  );
}

function CovRow({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] text-[10.5px] font-mono text-ink-soft">{label}</span>
      <div className="h-[5px] w-24 rounded-full bg-line-soft overflow-hidden"><div className={`h-full ${cls} grow-bar`} style={{ width: `${v}%` }} /></div>
      <span className="font-mono text-[10.5px] text-ink-faint">{v}%</span>
    </div>
  );
}

function RegisterModal({ open, onClose, onRegister }: { open: boolean; onClose: () => void; onRegister: (d: { name: string; owner: string; ownerRole: string; env: string; purpose: string }) => void }) {
  const [d, setD] = useState({ name: '', owner: '', ownerRole: '', env: '', purpose: '' });
  const valid = d.name.trim() && d.owner.trim() && d.purpose.trim().length >= 40;
  const submit = () => { if (!valid) return; onRegister(d); setD({ name: '', owner: '', ownerRole: '', env: '', purpose: '' }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Register agent in the ledger">
      <p className="text-[12.5px] text-ink-soft mb-4 leading-relaxed">New agents begin <span className="font-semibold">unassured</span>: evaluation and connector rules start failing or awaiting manual validation until evidence accumulates. That is by design.</p>
      <Field label="Agent name"><input className="input" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="e.g. Sales Enablement Assistant" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Accountable owner"><input className="input" value={d.owner} onChange={e => setD({ ...d, owner: e.target.value })} placeholder="Name Surname" /></Field>
        <Field label="Owner role"><input className="input" value={d.ownerRole} onChange={e => setD({ ...d, ownerRole: e.target.value })} placeholder="e.g. Sales Ops Lead" /></Field>
      </div>
      <Field label="Environment" hint="Site collection or tenant path the agent serves."><input className="input" value={d.env} onChange={e => setD({ ...d, env: e.target.value })} placeholder="/sites/sales · contoso-lab" /></Field>
      <Field label="Business purpose" hint={<span className={d.purpose.length >= 40 ? 'text-pine-deep' : 'text-amber-deep'}>{d.purpose.length}/40 characters minimum — must name the business process served {d.purpose.length >= 40 && '✓ GR-102'}</span>}>
        <textarea className="input" rows={3} value={d.purpose} onChange={e => setD({ ...d, purpose: e.target.value })} placeholder="e.g. Answers sales playbook questions for the enablement team from the approved playbook library; escalates pricing exceptions to the deal desk." />
      </Field>
      <div className="flex justify-end gap-2 mt-1">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid} onClick={submit}><I n="shieldCheck" s={15} />Register & score</button>
      </div>
    </Modal>
  );
}
