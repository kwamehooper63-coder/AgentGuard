import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { EvalKind } from '../lib/data';
import { RULE_MAP, agentStatus, daysUntil, fmtDate, fmtDateTime, scoreAgent, ago } from '../lib/data';
import { I, ScoreRing, StatusChip, StateChip, ConfDots, Tabs, Modal, Field, Initials, ConfidenceBar } from '../components/ui';

export default function AgentDetail() {
  const { activeId, agents, exceptions, audit, closeAgent, attest, logEvaluation, flagRule, sendReminder, advanceException, openAgent } = useStore();
  const agent = agents.find(a => a.id === activeId);
  const [tab, setTab] = useState('rules');
  const [attestOpen, setAttestOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [agree, setAgree] = useState(false);

  const agentExceptions = useMemo(() => exceptions.filter(e => e.agentId === activeId), [exceptions, activeId]);
  const timeline = useMemo(() => audit.filter(a => a.target.includes(activeId ?? '∅') || a.detail.includes(activeId ?? '∅')).slice().reverse(), [audit, activeId]);

  if (!agent) return null;
  const s = scoreAgent(agent);
  const st = agentStatus(agent, exceptions);
  const d = daysUntil(agent.nextReview);
  const attestationAge = -daysUntil(agent.attestedAt);

  const next = (id: string) => { const i = agents.findIndex(a => a.id === id); if (i >= 0) openAgent(agents[(i + 1) % agents.length].id); };
  const prev = (id: string) => { const i = agents.findIndex(a => a.id === id); if (i >= 0) openAgent(agents[(i - 1 + agents.length) % agents.length].id); };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-pine-ink/40 backdrop-blur-[2px]" onClick={closeAgent} />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[900px] bg-paper border-l border-line shadow-2xl drawer-in flex flex-col">
        {/* header */}
        <div className="bg-card border-b border-line px-6 py-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <ScoreRing value={s.score} band={s.band} size={72} stroke={7} label={s.band} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-bold text-[21px] leading-tight">{agent.name}</h2>
                  <StatusChip status={st} />
                </div>
                <div className="font-mono text-[11.5px] text-ink-faint mt-0.5">{agent.id} · {agent.env}</div>
                <div className="flex items-center gap-4 mt-2 flex-wrap text-[12px] text-ink-soft">
                  <span className="inline-flex items-center gap-1.5"><Initials name={agent.owner} size={22} /><span><span className="font-medium text-ink">{agent.owner}</span> · {agent.ownerRole}</span></span>
                  <span className={`inline-flex items-center gap-1 ${d < 0 ? 'text-red font-semibold' : ''}`}><I n="calendar" s={13} />Review {fmtDate(agent.nextReview)} ({d < 0 ? `${-d}d overdue` : `in ${d}d`})</span>
                  <span className="inline-flex items-center gap-1"><I n="clock" s={13} />Swept {ago(agent.lastEvaluated)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button className="btn-ghost h-8 px-2.5" onClick={() => prev(agent.id)} title="Previous agent"><I n="chevR" s={14} c="rotate-180" /></button>
              <button className="btn-ghost h-8 px-2.5" onClick={() => next(agent.id)} title="Next agent"><I n="chevR" s={14} /></button>
              <button className="btn-ghost h-8 px-2.5" onClick={closeAgent} aria-label="Close"><I n="x" s={15} /></button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3.5 flex-wrap no-print">
            <button className="btn-primary h-8 text-[12.5px]" onClick={() => { setAgree(false); setAttestOpen(true); }}><I n="shieldCheck" s={14} />Refresh attestation</button>
            <button className="btn-ghost h-8 text-[12.5px]" onClick={() => setEvalOpen(true)} disabled={!!agent.retired}><I n="flask" s={14} />Log evaluation</button>
            <button className="btn-ghost h-8 text-[12.5px]" onClick={() => sendReminder(agent.id)} disabled={!!agent.retired || !!agent.reminderSentAt}><I n="send" s={14} />{agent.reminderSentAt ? 'Reminder sent' : 'Teams reminder'}</button>
            <div className="ml-auto flex items-center gap-2 text-[11.5px] text-ink-soft">
              Evidence confidence <ConfidenceBar value={s.confidence} />
            </div>
          </div>
          <div className="mt-3.5"><Tabs
            tabs={[
              { id: 'rules', label: 'Rule results', count: s.fail + s.manual },
              { id: 'knowledge', label: 'Knowledge', count: agent.knowledge.length },
              { id: 'permissions', label: 'Permissions', count: agent.permissions.length },
              { id: 'evaluations', label: 'Evaluations', count: agent.evaluations.length },
              { id: 'exceptions', label: 'Exceptions', count: agentExceptions.filter(e => e.status !== 'closed').length },
              { id: 'attestation', label: 'Attestation' },
              { id: 'timeline', label: 'Timeline' },
            ]} active={tab} onChange={setTab} /></div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'rules' && <RulesTab agent={agent} onFlag={flagRule} />}
          {tab === 'knowledge' && <KnowledgeTab agent={agent} />}
          {tab === 'permissions' && <PermissionsTab agent={agent} />}
          {tab === 'evaluations' && <EvalsTab agent={agent} onLog={() => setEvalOpen(true)} />}
          {tab === 'exceptions' && <ExceptionsTab list={agentExceptions} onAdvance={advanceException} />}
          {tab === 'attestation' && <AttestTab agent={agent} age={attestationAge} onRefresh={() => { setAgree(false); setAttestOpen(true); }} />}
          {tab === 'timeline' && <TimelineTab list={timeline} />}
        </div>
      </aside>

      {/* attest modal */}
      <Modal open={attestOpen} onClose={() => setAttestOpen(false)} title={`Owner attestation · ${agent.name}`}>
        <div className="rounded-md border border-line bg-white/70 p-3.5 mb-4">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1">Recorded purpose</div>
          <p className="text-[13px] leading-relaxed">{agent.purpose}</p>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer mb-4">
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1 accent-[#157355] w-4 h-4" />
          <span className="text-[13px] leading-relaxed">I confirm the business purpose above is current, the accountable owner is correct, and the approved knowledge sources still match operational need.</span>
        </label>
        <div className="text-[12px] text-ink-soft mb-4 flex items-center gap-2"><I n="clock" s={14} />Restarts the 90-day window · closes any open GR-103 exception · appended to the audit chain.</div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setAttestOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={!agree} onClick={() => { attest(agent.id); setAttestOpen(false); }}><I n="check" s={15} w={2.2} />Record attestation</button>
        </div>
      </Modal>

      <EvalModal open={evalOpen} onClose={() => setEvalOpen(false)} onSubmit={(k, c, p, n) => { logEvaluation(agent.id, k, c, p, n); setEvalOpen(false); }} />
    </div>
  );
}

// ─── tabs ─────────────────────────────────────────────────────────────────────
function RulesTab({ agent, onFlag }: { agent: any; onFlag: (a: string, r: string) => void }) {
  const { exceptions } = useStore();
  const hasOpen = (rid: string) => exceptions.some(e => e.agentId === agent.id && e.ruleId === rid && e.status !== 'closed');
  const cats = [...new Set((agent.rules as any[]).map((r: any) => RULE_MAP[r.ruleId]?.category).filter(Boolean))] as string[];
  return (
    <div className="space-y-5">
      {cats.map(cat => (
        <div key={cat}>
          <div className="kicker mb-2">{cat}</div>
          <div className="card overflow-hidden">
            {(agent.rules as any[]).filter((r: any) => RULE_MAP[r.ruleId]?.category === cat).map((r: any, i: number) => {
              const rule = RULE_MAP[r.ruleId];
              const openEx = hasOpen(r.ruleId);
              return (
                <div key={r.ruleId} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line-soft' : ''} hover:bg-pine-tint/30 transition-colors`}>
                  <div className="w-[68px] shrink-0 pt-0.5"><span className="font-mono text-[11.5px] text-ink-soft">{r.ruleId}</span></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold">{rule.title}</span>
                      <span className="chip-gray">w{rule.weight}</span>
                      <span className="chip-steel">{rule.detection}</span>
                    </div>
                    {r.note && <div className={`text-[12px] mt-0.5 ${r.state === 'fail' ? 'text-red-deep' : r.state === 'manual' ? 'text-amber-deep' : 'text-ink-soft'}`}>{r.note}</div>}
                    <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-ink-faint">
                      {r.ref && <span>evidence {r.ref}</span>}
                      <span>{fmtDate(r.at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ConfDots level={r.confidence} />
                    <StateChip state={r.state} />
                    {(r.state === 'fail' || r.state === 'manual') && !openEx && !agent.retired && (
                      <button className="text-[11.5px] font-medium text-amber-deep hover:text-red transition-colors cursor-pointer" onClick={() => onFlag(agent.id, r.ruleId)}>Flag →</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="card p-4 border-amber/40 bg-amber-tint/40 flex items-start gap-2.5">
        <span className="text-amber-deep mt-0.5"><I n="info" s={16} /></span>
        <p className="text-[12.5px] leading-relaxed">Results marked <span className="chip-outline">Manual required</span> cannot be decided from metadata. They contribute partial credit at <span className="font-mono">low</span> confidence until a reviewer signs off through the exception flow.</p>
      </div>
    </div>
  );
}
function KnowledgeTab({ agent }: { agent: any }) {
  const unapproved = agent.knowledge.filter((k: any) => !k.approved);
  return (
    <div className="space-y-4">
      {agent.knowledge.length === 0 && <Empty msg="No sources enumerated yet — the first connector sweep (GR-201) will populate this inventory." />}
      {agent.knowledge.length > 0 && (
        <div className="card overflow-hidden">
          <table className="tbl w-full">
            <thead><tr><th>Source</th><th>Kind</th><th>Path</th><th>Items</th><th>Crawled</th><th>Approved</th></tr></thead>
            <tbody>
              {agent.knowledge.map((k: any) => (
                <tr key={k.path}>
                  <td className="font-semibold text-[13px]">{k.name}</td>
                  <td className="text-[12.5px] text-ink-soft">{k.kind}</td>
                  <td className="font-mono text-[11.5px] text-steel">{k.path}</td>
                  <td className="font-mono text-[12px]">{k.items.toLocaleString()}</td>
                  <td className="font-mono text-[11.5px] text-ink-faint">{ago(k.crawled)}</td>
                  <td>{k.approved ? <span className="chip-pine"><I n="check" s={11} w={2.2} />Approved</span> : <span className="chip-red"><I n="alert" s={11} w={2} />Outside scope</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {unapproved.length > 0 && (
        <div className="card p-4 border-red/40 bg-red-tint/50">
          <div className="flex items-center gap-2 text-red-deep font-semibold text-[13px] mb-1.5"><I n="alert" s={15} w={2} />GR-202 · Set difference non-empty</div>
          <p className="text-[12.5px] leading-relaxed mb-2">Crawled paths outside the owner-approved set:</p>
          {unapproved.map((k: any) => (
            <div key={k.path} className="font-mono text-[12px] bg-white/70 border border-red/25 rounded px-2.5 py-1.5 mb-1.5 flex items-center justify-between">
              <span className="text-red-deep">{k.path}</span><span className="text-ink-faint">{k.items.toLocaleString()} items reachable</span>
            </div>
          ))}
          <p className="text-[12px] text-ink-soft mt-2">Remediation: restrict the agent's grounding configuration to approved paths, then re-run a sweep.</p>
        </div>
      )}
      <div className="card p-4 flex items-start gap-2.5">
        <span className="text-pine-deep mt-0.5"><I n="eye" s={16} /></span>
        <p className="text-[12.5px] leading-relaxed text-ink-soft"><span className="font-semibold text-ink">Metadata-only.</span> The connector reads paths, item counts and permission snapshots. Document content and prompts never enter the assurance store.</p>
      </div>
    </div>
  );
}

function PermissionsTab({ agent }: { agent: any }) {
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <table className="tbl w-full">
          <thead><tr><th>Scope</th><th>Granted</th><th>Documented requirement</th><th>Least privilege</th></tr></thead>
          <tbody>
            {agent.permissions.map((p: any) => (
              <tr key={p.scope}>
                <td className="font-mono text-[12px] font-semibold">{p.scope}</td>
                <td className="font-mono text-[12px] text-steel">{p.granted}</td>
                <td className="font-mono text-[12px] text-ink-soft">{p.required}</td>
                <td>{p.state === 'ok' ? <span className="chip-pine"><I n="check" s={11} w={2.2} />Within requirement</span> : p.state === 'review' ? <span className="chip-amber"><I n="clock" s={11} />Broader than needed</span> : <span className="chip-red"><I n="alert" s={11} w={2} />Elevated — breach</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card p-4 flex items-start gap-2.5">
        <span className="text-pine-deep mt-0.5"><I n="lock" s={16} /></span>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">AgentGuard itself runs on <span className="font-mono text-[12px]">Sites.Selected</span> + <span className="font-mono text-[12px]">Application.Read.All</span> — read-only, enumerated sites. The permission matrix under <span className="font-semibold text-ink">System</span> lists every requested scope.</p>
      </div>
    </div>
  );
}

function EvalsTab({ agent, onLog }: { agent: any; onLog: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-ink-soft">Fixture suites replay against the agent in the lab sandbox. Prompts are hashed; content is not stored.</p>
        {!agent.retired && <button className="btn-primary h-8 text-[12.5px]" onClick={onLog}><I n="flask" s={14} />Log evaluation</button>}
      </div>
      {agent.evaluations.length === 0 ? <Empty msg="No evaluation evidence yet — GR-401/402/403 will fail until suites are recorded." /> : (
        <div className="card overflow-hidden">
          <table className="tbl w-full">
            <thead><tr><th>Evidence</th><th>Suite</th><th>Run</th><th>Result</th><th>Fixture hash</th></tr></thead>
            <tbody>
              {agent.evaluations.map((e: any) => {
                const rate = Math.round(100 * e.passed / Math.max(e.cases, 1));
                return (
                  <tr key={e.id}>
                    <td className="font-mono text-[12px] font-semibold text-pine-deep">{e.id}</td>
                    <td>
                      <div className="text-[13px] font-medium">{e.suite}</div>
                      <div className="font-mono text-[10.5px] text-ink-faint">{e.kind}</div>
                    </td>
                    <td className="font-mono text-[11.5px] text-ink-soft">{fmtDate(e.at)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-[6px] w-20 rounded-full bg-line-soft overflow-hidden"><div className={`h-full grow-bar ${rate >= 95 ? 'bg-pine' : 'bg-red'}`} style={{ width: `${rate}%` }} /></div>
                        <span className={`font-mono text-[11.5px] ${rate >= 95 ? 'text-pine-deep' : 'text-red'}`}>{e.passed}/{e.cases}</span>
                      </div>
                    </td>
                    <td className="font-mono text-[11px] text-ink-faint">{e.ref}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExceptionsTab({ list, onAdvance }: { list: any[]; onAdvance: (id: string) => void }) {
  if (list.length === 0) return <Empty msg="No exceptions for this agent — findings raise exceptions automatically when sweeps fail." />;
  return (
    <div className="space-y-3">
      {list.map(e => {
        const action = e.status === 'open' ? 'Acknowledge' : e.status === 'acknowledged' ? 'Start remediation' : e.status === 'remediating' ? 'Verify & close' : null;
        return (
          <div key={e.id} className={`card p-4 border-l-4 ${e.severity === 'high' ? 'border-l-red' : e.severity === 'medium' ? 'border-l-amber' : 'border-l-line'} ${e.status === 'closed' ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[12px] font-semibold">{e.id}</span>
                <span className="chip-gray">{e.ruleId}</span>
                <span className={`chip ${e.severity === 'high' ? 'bg-red-tint text-red-deep' : 'bg-amber-tint text-amber-deep'}`}>{e.severity}</span>
                <span className="chip-steel">{e.status}</span>
              </div>
              {action && <button className={`h-8 text-[12.5px] ${e.status === 'remediating' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onAdvance(e.id)}>{action}</button>}
            </div>
            <div className="text-[13.5px] font-semibold mt-1.5">{e.title}</div>
            <div className="font-mono text-[11px] text-ink-faint mt-0.5">Assignee {e.assignee} · opened {fmtDate(e.openedAt)} · due {fmtDate(e.dueBy)}</div>
            {e.resolution && <div className="text-[12px] text-pine-deep mt-1.5">✓ {e.resolution}</div>}
          </div>
        );
      })}
    </div>
  );
}

function AttestTab({ agent, age, onRefresh }: { agent: any; age: number; onRefresh: () => void }) {
  const fresh = age <= 90;
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="kicker">Purpose attestation</div>
          <span className={fresh ? 'chip-pine' : 'chip-red'}>{fresh ? `Fresh · ${age}d old` : `Expired · ${age - 90}d over`}</span>
        </div>
        <p className="text-[14px] leading-relaxed mb-4">{agent.purpose}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <MetaCell k="Attested by" v={agent.attestedBy} />
          <MetaCell k="Attested on" v={fmtDate(agent.attestedAt)} />
          <MetaCell k="Next review" v={fmtDate(agent.nextReview)} />
        </div>
        <div className="mt-4">
          <div className="flex justify-between font-mono text-[10.5px] text-ink-faint mb-1"><span>90-day window</span><span>{Math.min(age, 90)}/90d</span></div>
          <div className="h-[7px] rounded-full bg-line-soft overflow-hidden">
            <div className={`h-full grow-bar ${age > 90 ? 'bg-red' : age > 70 ? 'bg-amber' : 'bg-pine'}`} style={{ width: `${Math.min(100, (age / 90) * 100)}%` }} />
          </div>
        </div>
        {!agent.retired && <button className="btn-primary mt-4" onClick={onRefresh}><I n="refresh" s={15} />Refresh attestation</button>}
      </div>
      <div className="card p-4 flex items-start gap-2.5">
        <span className="text-steel mt-0.5"><I n="info" s={16} /></span>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">Attestation is a <span className="font-semibold text-ink">GR-102/GR-103</span> input, not a guarantee: it records that a named human accepted accountability on a date. Automated rules re-verify continuously around it.</p>
      </div>
    </div>
  );
}

function TimelineTab({ list }: { list: any[] }) {
  if (list.length === 0) return <Empty msg="No audit entries reference this agent yet." />;
  return (
    <div className="space-y-0">
      {list.map((e, i) => (
        <div key={e.id} className="flex gap-3.5 relative pb-5">
          {i < list.length - 1 && <span className="absolute left-[9px] top-5 bottom-0 w-px bg-line" />}
          <span className={`w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${e.kind === 'user' ? 'border-pine bg-pine-tint text-pine-deep' : e.kind === 'connector' ? 'border-steel bg-steel-tint text-steel' : 'border-ink-faint bg-line-soft text-ink-soft'}`}>
            <I n={e.kind === 'user' ? 'user' : e.kind === 'connector' ? 'plug' : 'shield'} s={10} w={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px]"><span className="font-semibold">{e.action}</span> <span className="text-ink-soft">· {e.target}</span></div>
            <div className="text-[12px] text-ink-soft mt-0.5">{e.detail}</div>
            <div className="font-mono text-[10.5px] text-ink-faint mt-0.5">{fmtDateTime(e.at)} · {e.actor} · chain 0x{e.chain}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetaCell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-white/60 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{k}</div>
      <div className="text-[13px] font-medium mt-0.5">{v}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="card p-8 text-center text-[13px] text-ink-faint">{msg}</div>;
}

function EvalModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (k: EvalKind, cases: number, passed: number, note: string) => void }) {
  const [kind, setKind] = useState<EvalKind>('response-quality');
  const [cases, setCases] = useState(50);
  const [passed, setPassed] = useState(50);
  const [note, setNote] = useState('');
  const valid = cases >= 10 && passed >= 0 && passed <= cases;
  const kinds: [EvalKind, string, string][] = [
    ['response-quality', 'Response quality', 'GR-401 · fixture answers vs golden set'],
    ['access-boundary', 'Access boundary canaries', 'GR-402 · out-of-scope canary documents'],
    ['escalation', 'Escalation & refusal', 'GR-403 · out-of-scope prompts route to humans'],
  ];
  return (
    <Modal open={open} onClose={onClose} title="Log evaluation evidence">
      <Field label="Suite type">
        <div className="space-y-1.5">
          {kinds.map(([id, label, sub]) => (
            <label key={id} className={`flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors ${kind === id ? 'border-pine bg-pine-tint/60' : 'border-line hover:border-pine/40'}`}>
              <input type="radio" checked={kind === id} onChange={() => setKind(id)} className="accent-[#157355]" />
              <span><span className="block text-[13px] font-medium">{label}</span><span className="block font-mono text-[10.5px] text-ink-faint">{sub}</span></span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cases run"><input type="number" className="input" value={cases} min={0} onChange={e => setCases(+e.target.value)} /></Field>
        <Field label="Cases passed"><input type="number" className="input" value={passed} min={0} onChange={e => setPassed(+e.target.value)} /></Field>
      </div>
      <Field label="Run note (optional)"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Fixture pack, environment, anomalies…" /></Field>
      <div className={`text-[12px] mb-3 ${valid && passed / Math.max(cases, 1) >= 0.95 ? 'text-pine-deep' : 'text-amber-deep'}`}>
        {valid ? (passed / Math.max(cases, 1) >= 0.95 && cases >= 10 ? 'Will record a pass with high-confidence evidence.' : 'Below the 95% threshold — will fail the rule and raise an exception automatically.') : 'Minimum 10 cases; passed cannot exceed cases.'}
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid} onClick={() => onSubmit(kind, cases, passed, note)}><I n="flask" s={15} />Store evidence</button>
      </div>
    </Modal>
  );
}
