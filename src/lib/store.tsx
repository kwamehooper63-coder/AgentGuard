import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AgentRecord, AuditEntry, Connector, ExceptionRec, EvalKind, RuleResult } from './data';
import {
  SEED_AGENTS, SEED_AUDIT, SEED_CONNECTORS, SEED_EXCEPTIONS, RULES, RULE_MAP,
  day, daysUntil, fmtDate, nextHash, scoreAgent,
} from './data';

export type ViewId = 'registry' | 'rules' | 'exceptions' | 'reports' | 'audit' | 'system';

interface Toast { id: number; text: string; tone: 'pine' | 'amber' | 'red' }

interface Store {
  view: ViewId; setView: (v: ViewId) => void;
  agents: AgentRecord[]; exceptions: ExceptionRec[]; audit: AuditEntry[]; connectors: Connector[];
  activeId: string | null; openAgent: (id: string) => void; closeAgent: () => void;
  toasts: Toast[];
  scanning: boolean; scanStep: number; lastSweepAt: string;
  history: number[];
  attest: (agentId: string) => void;
  logEvaluation: (agentId: string, kind: EvalKind, cases: number, passed: number, note: string) => void;
  advanceException: (id: string) => void;
  flagRule: (agentId: string, ruleId: string) => void;
  sendReminder: (agentId: string) => void;
  toggleConnector: (id: string) => void;
  runScan: () => void;
  registerAgent: (d: { name: string; owner: string; ownerRole: string; env: string; purpose: string }) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
}

const Ctx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Ctx);

const SCAN_STEPS = [
  'Enumerating agents via Microsoft Graph…',
  'Reading SharePoint source metadata (read-only)…',
  'Replaying evaluation fixtures…',
  'Recomputing assurance scores…',
];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>('registry');
  const [agents, setAgents] = useState<AgentRecord[]>(SEED_AGENTS);
  const [exceptions, setExceptions] = useState<ExceptionRec[]>(SEED_EXCEPTIONS);
  const [audit, setAudit] = useState<AuditEntry[]>(SEED_AUDIT);
  const [connectors, setConnectors] = useState<Connector[]>(SEED_CONNECTORS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [lastSweepAt, setLastSweepAt] = useState(day(-2));
  const [history, setHistory] = useState<number[]>([71, 73, 72, 74, 76, 78, 79]);
  const evCounter = useRef(1150);
  const exCounter = useRef(107);
  const agCounter = useRef(8);
  const auCounter = useRef(100);
  const toastId = useRef(1);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'pine') => {
    const id = toastId.current++;
    setToasts(t => [...t, { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  const appendAudit = useCallback((actor: string, kind: AuditEntry['kind'], action: string, target: string, detail: string) => {
    setAudit(prev => {
      const chain = nextHash(prev[prev.length - 1]?.chain ?? 'genesis0', action + target + Date.now());
      const entry: AuditEntry = { id: `AU-${String(auCounter.current++).padStart(3, '0')}`, at: new Date().toISOString(), actor, kind, action, target, detail, chain };
      return [...prev, entry];
    });
  }, []);

  const patchAgent = useCallback((id: string, fn: (a: AgentRecord) => AgentRecord) => {
    setAgents(prev => prev.map(a => (a.id === id ? fn(a) : a)));
  }, []);

  const setRule = (a: AgentRecord, ruleId: string, state: RuleResult['state'], confidence: RuleResult['confidence'], note?: string, ref?: string): AgentRecord => ({
    ...a,
    rules: a.rules.map(r => (r.ruleId === ruleId ? { ruleId, state, confidence, at: new Date().toISOString(), note, ref } : r)),
  });

  const attest = useCallback((agentId: string) => {
    const now = new Date().toISOString();
    patchAgent(agentId, a => ({
      ...setRule({ ...a, attestedBy: 'Governance Admin (you)', attestedAt: now, nextReview: day(90) }, 'GR-103', 'pass', 'high', 'Attestation refreshed via console'),
    }));
    setExceptions(prev => prev.map(e =>
      e.agentId === agentId && e.ruleId === 'GR-103' && e.status !== 'closed'
        ? { ...e, status: 'closed', closedAt: now, resolution: 'Owner attestation refreshed — 90-day window restarted.', history: [...e.history, { at: now, by: 'Governance Admin', action: 'Closed — attestation refreshed' }] }
        : e,
    ));
    appendAudit('Governance Admin (you)', 'user', 'Attestation refreshed', agentId, `Purpose & ownership confirmed — next review ${fmtDate(day(90))}`);
    toast(`Attestation recorded — next review ${fmtDate(day(90))}`);
  }, [appendAudit, patchAgent, toast]);

  const logEvaluation = useCallback((agentId: string, kind: EvalKind, cases: number, passed: number, note: string) => {
    const now = new Date().toISOString();
    const id = `EV-${evCounter.current++}`;
    const suiteMap: Record<EvalKind, [string, string]> = {
      'response-quality': ['RQ-20 · Console fixture set', 'GR-401'],
      'access-boundary': ['AB-12 · Canary boundary probes', 'GR-402'],
      escalation: ['ES-08 · Escalation & refusal', 'GR-403'],
    };
    const [suite, ruleId] = suiteMap[kind];
    const rate = passed / Math.max(cases, 1);
    const ok = cases >= 10 && rate >= 0.95;
    patchAgent(agentId, a => {
      const next = setRule({ ...a, lastEvaluated: now }, ruleId, ok ? 'pass' : 'fail', ok ? 'high' : 'medium', ok ? `${passed}/${cases} cases passed (${Math.round(rate * 100)}%)` : `Below 95% threshold: ${passed}/${cases}`, id);
      return { ...next, evaluations: [{ id, kind, suite, at: now, cases, passed, ref: `sha256:${(Math.random() * 0xffff).toString(16).padStart(4, '0')}…${(Math.random() * 0xfff).toString(16)}` }, ...a.evaluations] };
    });
    if (!ok) {
      const exId = `EX-${exCounter.current++}`;
      setExceptions(prev => [...prev, {
        id: exId, agentId, ruleId, title: `${RULE_MAP[ruleId].title} — ${Math.round(rate * 100)}% pass rate`,
        severity: kind === 'access-boundary' ? 'high' : 'medium', status: 'open', assignee: 'Governance Admin',
        openedAt: now, dueBy: day(kind === 'access-boundary' ? 5 : 10),
        history: [{ at: now, by: 'Assurance engine', action: `Opened automatically — suite ${suite} below threshold${note ? ` · ${note}` : ''}` }],
      }]);
      appendAudit('Assurance engine', 'system', 'Evaluation failed — exception raised', agentId, `${suite}: ${passed}/${cases} · ${exId} opened`);
      toast(`Suite ${rate < 1 ? `${Math.round(rate * 100)}%` : ''} below threshold — ${exId} raised`, 'red');
    } else {
      appendAudit('Governance Admin (you)', 'user', 'Evaluation logged', agentId, `${suite}: ${passed}/${cases} passed · evidence ${id}`);
      toast(`${suite} passed ${passed}/${cases} — evidence ${id} stored`);
    }
  }, [appendAudit, patchAgent, toast]);

  const advanceException = useCallback((id: string) => {
    const now = new Date().toISOString();
    const flow: Record<string, { next: ExceptionRec['status']; action: string }> = {
      open: { next: 'acknowledged', action: 'Acknowledged by owner' },
      acknowledged: { next: 'remediating', action: 'Remediation plan recorded' },
      remediating: { next: 'closed', action: 'Verified closed — evidence re-checked' },
    };
    let detail = '';
    setExceptions(prev => prev.map(e => {
      if (e.id !== id) return e;
      const f = flow[e.status];
      if (!f) return e;
      detail = `${e.id} → ${f.next}`;
      return { ...e, status: f.next, closedAt: f.next === 'closed' ? now : e.closedAt, resolution: f.next === 'closed' ? 'Remediation verified on latest sweep.' : e.resolution, history: [...e.history, { at: now, by: 'Governance Admin (you)', action: f.action }] };
    }));
    setTimeout(() => {
      appendAudit('Governance Admin (you)', 'user', 'Exception status changed', detail.split(' ')[0] ?? id, detail);
      toast(`${detail} — audit entry appended`);
    }, 0);
  }, [appendAudit, toast]);

  const flagRule = useCallback((agentId: string, ruleId: string) => {
    const now = new Date().toISOString();
    const rule = RULE_MAP[ruleId];
    const exId = `EX-${exCounter.current++}`;
    setExceptions(prev => [...prev, {
      id: exId, agentId, ruleId, title: `${rule.title} — flagged for review`,
      severity: rule.weight === 3 ? 'high' : 'medium', status: 'open', assignee: 'Governance Admin',
      openedAt: now, dueBy: day(rule.detection === 'manual' ? 14 : 7),
      history: [{ at: now, by: 'Governance Admin (you)', action: 'Manually flagged from rule results' }],
    }]);
    appendAudit('Governance Admin (you)', 'user', 'Rule flagged for review', agentId, `${ruleId} · ${exId} opened`);
    toast(`${exId} opened for ${ruleId}`, 'amber');
  }, [appendAudit, toast]);

  const sendReminder = useCallback((agentId: string) => {
    const now = new Date().toISOString();
    const agent = agents.find(a => a.id === agentId);
    patchAgent(agentId, a => ({ ...a, reminderSentAt: now }));
    appendAudit('Teams connector', 'connector', 'Review reminder sent', agentId, `Ping queued to ${agent?.owner ?? 'owner'} via Teams webhook`);
    toast(`Teams reminder queued to ${agent?.owner ?? 'owner'}`);
  }, [agents, appendAudit, patchAgent, toast]);

  const toggleConnector = useCallback((id: string) => {
    setConnectors(prev => prev.map(c => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
    const c = connectors.find(x => x.id === id);
    if (c) appendAudit('Governance Admin (you)', 'user', c.enabled ? 'Connector disabled' : 'Connector enabled', c.name, c.enabled ? 'Marked offline — dependent rules drop to manual' : 'Reconnected in metadata-only mode');
  }, [appendAudit, connectors]);

  const runScan = useCallback(() => {
    if (scanning) return;
    setScanning(true);
    setScanStep(0);
    SCAN_STEPS.forEach((_, i) => setTimeout(() => setScanStep(i + 1), 650 * (i + 1)));
    setTimeout(() => {
      const now = new Date().toISOString();
      setAgents(prev => prev.map(a => (a.retired ? a : { ...a, lastEvaluated: now })));
      setLastSweepAt(now);
      appendAudit('Metadata connector', 'connector', 'Sweep completed', 'tenant:contoso-lab', `${agents.filter(a => !a.retired).length} agents · ${RULES.length} rules · metadata-only · 0 content reads`);
      const scores = agents.filter(a => !a.retired).map(a => scoreAgent(a).score);
      const avg = Math.round(scores.reduce((x, y) => x + y, 0) / Math.max(scores.length, 1));
      setHistory(h => [...h.slice(-11), avg]);
      setScanning(false);
      toast('Sweep complete — deterministic scores recomputed (metadata-only)');
    }, 650 * SCAN_STEPS.length + 500);
  }, [agents, appendAudit, scanning, toast]);

  const registerAgent = useCallback((d: { name: string; owner: string; ownerRole: string; env: string; purpose: string }) => {
    const now = new Date().toISOString();
    const id = `AG-${String(agCounter.current++).padStart(3, '0')}`;
    const mk = (ruleId: string, state: RuleResult['state'], conf: RuleResult['confidence'], note?: string): RuleResult =>
      ({ ruleId, state, confidence: conf, at: now, note });
    const agent: AgentRecord = {
      id, name: d.name, env: d.env || '/sites/unassigned · contoso-lab', owner: d.owner, ownerRole: d.ownerRole,
      purpose: d.purpose, attestedBy: 'Governance Admin (you)', attestedAt: now, nextReview: day(90), lastEvaluated: now,
      knowledge: [], permissions: [],
      rules: RULES.map(r => {
        if (r.id === 'GR-101') return mk(r.id, 'pass', 'medium', 'Owner assigned at registration');
        if (r.id === 'GR-102') return mk(r.id, d.purpose.length >= 40 ? 'pass' : 'fail', 'medium', d.purpose.length >= 40 ? 'Purpose documented at registration' : 'Purpose statement too short');
        if (r.id === 'GR-103') return mk(r.id, 'pass', 'high');
        if (r.id === 'GR-501') return mk(r.id, 'pass', 'high');
        if (r.id === 'GR-502') return mk(r.id, 'pass', 'high');
        if (r.id === 'GR-302') return mk(r.id, 'pass', 'high', 'No elevated role detected on first sweep');
        if (r.id === 'GR-401' || r.id === 'GR-402' || r.id === 'GR-403') return mk(r.id, 'fail', 'medium', 'No evaluation evidence yet');
        return mk(r.id, 'manual', 'low', 'Awaiting connector sweep / manual validation');
      }),
      evaluations: [],
    };
    setAgents(prev => [...prev, agent]);
    appendAudit('Governance Admin (you)', 'user', 'Agent registered', id, `${d.name} · owner ${d.owner} · initial score ${scoreAgent(agent).score}`);
    toast(`${id} registered — initial score ${scoreAgent(agent).score} (evidence pending)`, 'amber');
  }, [appendAudit, toast]);

  const openAgent = useCallback((id: string) => setActiveId(id), []);
  const closeAgent = useCallback(() => setActiveId(null), []);

  const store = useMemo<Store>(() => ({
    view, setView, agents, exceptions, audit, connectors, activeId, openAgent, closeAgent,
    toasts, scanning, scanStep, lastSweepAt, history,
    attest, logEvaluation, advanceException, flagRule, sendReminder, toggleConnector, runScan, registerAgent, toast,
  }), [view, agents, exceptions, audit, connectors, activeId, openAgent, closeAgent, toasts, scanning, scanStep, lastSweepAt, history, attest, logEvaluation, advanceException, flagRule, sendReminder, toggleConnector, runScan, registerAgent, toast]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

// shared selectors
export const openExceptions = (list: ExceptionRec[]) => list.filter(e => e.status !== 'closed');
export const overdueAgents = (agents: AgentRecord[]) => agents.filter(a => !a.retired && daysUntil(a.nextReview) < 0);
