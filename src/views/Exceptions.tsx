import { useMemo, useState } from 'react';
import { useStore, openExceptions } from '../lib/store';
import type { ExceptionStatus } from '../lib/data';
import { RULE_MAP, daysUntil, fmtDate, fmtDateTime } from '../lib/data';
import { I, SectionHead, Initials } from '../components/ui';

export default function Exceptions() {
  const { exceptions, agents, advanceException, openAgent } = useStore();
  const [filter, setFilter] = useState<'all' | ExceptionStatus>('all');
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const open = openExceptions(exceptions);
  const overdue = open.filter(e => daysUntil(e.dueBy) < 0);
  const closed30 = exceptions.filter(e => e.status === 'closed' && e.closedAt && daysUntil(e.closedAt) > -30);

  const rows = useMemo(() => {
    const list = filter === 'all' ? exceptions : exceptions.filter(e => e.status === filter);
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      const closedA = a.status === 'closed' ? 1 : 0, closedB = b.status === 'closed' ? 1 : 0;
      if (closedA !== closedB) return closedA - closedB;
      return rank[a.severity] - rank[b.severity] || daysUntil(a.dueBy) - daysUntil(b.dueBy);
    });
  }, [exceptions, filter]);

  const filters: ['all' | ExceptionStatus, string][] = [['all', 'All'], ['open', 'Open'], ['acknowledged', 'Acknowledged'], ['remediating', 'Remediating'], ['closed', 'Closed']];
  const actionLabel = (s: ExceptionStatus) => s === 'open' ? 'Acknowledge' : s === 'acknowledged' ? 'Start remediation' : s === 'remediating' ? 'Verify & close' : null;

  return (
    <div className="p-6 max-w-[1040px] mx-auto">
      <SectionHead
        kicker="Findings → owners → evidence"
        title="Exception & remediation flow"
        sub="Every failed or manually-flagged rule becomes a tracked exception with an assignee, a due date and an append-only history. Nothing closes without evidence."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 reveal" style={{ animationDelay: '60ms' }}>
        <Kpi label="Open now" value={open.length} tone={open.length ? 'red' : 'pine'} icon="alert" />
        <Kpi label="High severity" value={open.filter(e => e.severity === 'high').length} tone="red" icon="shield" />
        <Kpi label="Overdue" value={overdue.length} tone={overdue.length ? 'amber' : 'pine'} icon="clock" />
        <Kpi label="Closed · 30d" value={closed30.length} tone="pine" icon="check" />
      </div>

      <div className="flex items-center gap-1.5 mb-4 reveal" style={{ animationDelay: '100ms' }}>
        {filters.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-3 h-8 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer border ${filter === id ? 'bg-pine-ink2 text-pine-tint border-pine-ink' : 'bg-card text-ink-soft border-line hover:border-pine/50'}`}>
            {label}
            <span className="ml-1.5 font-mono text-[10.5px] opacity-70">{id === 'all' ? exceptions.length : exceptions.filter(e => e.status === id).length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((e, i) => {
          const agent = agents.find(a => a.id === e.agentId);
          const rule = RULE_MAP[e.ruleId];
          const d = daysUntil(e.dueBy);
          const label = actionLabel(e.status);
          const histOpen = showHistory === e.id;
          return (
            <div key={e.id} className={`card border-l-4 reveal ${e.severity === 'high' ? 'border-l-red' : e.severity === 'medium' ? 'border-l-amber' : 'border-l-line'} ${e.status === 'closed' ? 'opacity-75' : 'card-hover'}`} style={{ animationDelay: `${120 + i * 45}ms` }}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[12px] font-bold">{e.id}</span>
                      <span className={`chip ${e.severity === 'high' ? 'bg-red-tint text-red-deep' : e.severity === 'medium' ? 'bg-amber-tint text-amber-deep' : 'bg-line-soft text-ink-soft'}`}>{e.severity}</span>
                      <span className={`chip ${e.status === 'closed' ? 'bg-pine-tint text-pine-deep' : 'bg-steel-tint text-steel'}`}>{e.status}</span>
                      <button className="chip-gray hover:bg-line transition-colors cursor-pointer" title={rule?.title} onClick={() => {}}>{e.ruleId}</button>
                    </div>
                    <div className="text-[14px] font-semibold mt-1.5 leading-snug">{e.title}</div>
                    <div className="flex items-center gap-4 mt-1.5 flex-wrap text-[12px] text-ink-soft">
                      {agent && (
                        <button onClick={() => openAgent(agent.id)} className="inline-flex items-center gap-1.5 font-medium text-pine-deep hover:underline cursor-pointer">
                          <Initials name={agent.name} size={20} />{agent.name}
                        </button>
                      )}
                      <span className="inline-flex items-center gap-1"><I n="user" s={13} />{e.assignee}</span>
                      <span className={`inline-flex items-center gap-1 font-mono text-[11.5px] ${e.status !== 'closed' && d < 0 ? 'text-red font-semibold' : ''}`}><I n="calendar" s={13} />due {fmtDate(e.dueBy)}{e.status !== 'closed' && (d < 0 ? ` · ${-d}d overdue` : ` · in ${d}d`)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setShowHistory(histOpen ? null : e.id)} className={`btn-ghost h-8 text-[12px] ${histOpen ? 'bg-pine-tint border-pine/50 text-pine-deep' : ''}`}>
                      History <I n="chevD" s={13} c={`transition-transform duration-200 ${histOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {label && (
                      <button onClick={() => advanceException(e.id)} className={`h-8 text-[12.5px] ${e.status === 'remediating' ? 'btn-primary' : 'btn-ghost'}`}>
                        {e.status === 'remediating' && <I n="check" s={14} w={2.2} />}{label}
                      </button>
                    )}
                  </div>
                </div>

                {/* pipeline */}
                <div className="flex items-center gap-1 mt-3.5">
                  {(['open', 'acknowledged', 'remediating', 'closed'] as ExceptionStatus[]).map((st, idx) => {
                    const order: Record<ExceptionStatus, number> = { open: 0, acknowledged: 1, remediating: 2, closed: 3 };
                    const reached = order[e.status] >= idx;
                    return (
                      <div key={st} className="flex items-center gap-1 flex-1 last:flex-none">
                        <span className={`flex items-center gap-1 text-[10.5px] font-mono px-1.5 py-0.5 rounded ${reached ? (st === 'closed' ? 'bg-pine-tint text-pine-deep' : 'bg-steel-tint text-steel') : 'bg-line-soft text-ink-faint'}`}>
                          {reached && <I n="check" s={9} w={2.5} />}{st}
                        </span>
                        {idx < 3 && <span className={`h-px flex-1 ${order[e.status] > idx ? 'bg-steel/60' : 'bg-line'}`} />}
                      </div>
                    );
                  })}
                </div>

                {histOpen && (
                  <div className="mt-3.5 pt-3.5 border-t border-line-soft reveal">
                    {e.resolution && <div className="text-[12.5px] text-pine-deep mb-2.5"><span className="font-semibold">Resolution:</span> {e.resolution}</div>}
                    <div className="space-y-2">
                      {e.history.map((h, hi) => (
                        <div key={hi} className="flex items-start gap-2.5 text-[12.5px]">
                          <span className="font-mono text-[10.5px] text-ink-faint w-[104px] shrink-0 pt-0.5">{fmtDateTime(h.at)}</span>
                          <span className="font-medium text-ink shrink-0">{h.by}</span>
                          <span className="text-ink-soft">{h.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="card p-10 text-center text-sm text-ink-faint">No exceptions in this state — a clean sweep is a good sweep.</div>}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: number; tone: 'pine' | 'amber' | 'red'; icon: string }) {
  const cls = { pine: 'text-pine-deep', amber: 'text-amber-deep', red: 'text-red' }[tone];
  return (
    <div className="card p-3.5 flex items-center gap-3 card-hover">
      <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${tone === 'red' ? 'bg-red-tint text-red' : tone === 'amber' ? 'bg-amber-tint text-amber-deep' : 'bg-pine-tint text-pine-deep'}`}>
        <I n={icon} s={17} />
      </span>
      <div>
        <div className={`font-display font-bold text-[22px] leading-none ${cls}`}>{value}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint mt-1">{label}</div>
      </div>
    </div>
  );
}
