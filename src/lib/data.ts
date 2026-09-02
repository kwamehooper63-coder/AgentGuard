// ─── AgentGuard 365 · domain model + deterministic assurance engine ───────────

export type RuleState = 'pass' | 'fail' | 'manual' | 'na';
export type Confidence = 'high' | 'medium' | 'low';
export type Detection = 'automated' | 'attestation' | 'manual';
export type AgentStatus = 'assured' | 'provisional' | 'at-risk' | 'exception' | 'retired';
export type EvalKind = 'response-quality' | 'access-boundary' | 'escalation';
export type ExceptionStatus = 'open' | 'acknowledged' | 'remediating' | 'closed';

export interface GovRule {
  id: string;
  category: string;
  title: string;
  check: string;
  weight: 1 | 2 | 3;
  detection: Detection;
  evidence: string;
  test: string;
}
export interface RuleResult { ruleId: string; state: RuleState; confidence: Confidence; at: string; ref?: string; note?: string; }
export interface KnowledgeSource { name: string; kind: string; path: string; items: number; approved: boolean; crawled: string; }
export interface PermissionGrant { scope: string; granted: string; required: string; state: 'ok' | 'review' | 'breach'; }
export interface EvaluationRec { id: string; kind: EvalKind; suite: string; at: string; cases: number; passed: number; ref: string; }
export interface AgentRecord {
  id: string; name: string; env: string; owner: string; ownerRole: string; purpose: string;
  attestedBy: string; attestedAt: string; nextReview: string; lastEvaluated: string;
  reminderSentAt?: string; retired?: boolean;
  knowledge: KnowledgeSource[]; permissions: PermissionGrant[]; rules: RuleResult[]; evaluations: EvaluationRec[];
}
export interface HistoryEvent { at: string; by: string; action: string; }
export interface ExceptionRec {
  id: string; agentId: string; ruleId: string; title: string; severity: 'high' | 'medium' | 'low';
  status: ExceptionStatus; assignee: string; openedAt: string; dueBy: string; closedAt?: string; resolution?: string;
  history: HistoryEvent[];
}
export interface AuditEntry { id: string; at: string; actor: string; kind: 'system' | 'user' | 'connector'; action: string; target: string; detail: string; chain: string; }
export interface Connector { id: string; name: string; role: string; mode: string; scopes: string[]; enabled: boolean; status: 'connected' | 'configured' | 'offline'; }

// ─── time helpers ─────────────────────────────────────────────────────────────
export const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
export const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${fmtTime(iso)}`;
export const ago = (iso: string) => {
  const d = -daysUntil(iso);
  if (d <= 0) return 'today';
  if (d === 1) return '1d ago';
  if (d < 30) return `${d}d ago`;
  return `${Math.round(d / 30)}mo ago`;
};

export function nextHash(prev: string, input: string) {
  let h = 2166136261;
  const s = prev + '|' + input;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── governance rule pack v2026.02 ────────────────────────────────────────────
export const RULE_PACK = 'v2026.02';
export const RULES: GovRule[] = [
  { id: 'GR-101', category: 'Identity & ownership', weight: 3, detection: 'automated', title: 'Accountable owner recorded', check: 'Owner field resolves to a single licensed user — never a shared mailbox, distribution list or empty value.', evidence: 'Entra object resolution snapshot', test: 'assert agent.owner is User\nassert not agent.owner.isSharedMailbox' },
  { id: 'GR-102', category: 'Identity & ownership', weight: 3, detection: 'attestation', title: 'Business purpose documented & approved', check: 'Purpose statement names the business process served and is approved by the accountable owner.', evidence: 'Signed attestation record', test: 'assert len(agent.purpose) >= 40\nassert agent.purposeApprovedBy == agent.owner' },
  { id: 'GR-103', category: 'Identity & ownership', weight: 2, detection: 'automated', title: 'Attestation fresh (≤ 90 days)', check: 'Owner attestation refreshed within the 90-day review window.', evidence: 'Attestation timestamp', test: 'assert (now - agent.attestedAt).days <= 90' },
  { id: 'GR-201', category: 'Knowledge & scope', weight: 3, detection: 'automated', title: 'Knowledge sources enumerated', check: 'Connector returns at least one source with site path and item count; inventory younger than 30 days.', evidence: 'SharePoint metadata sweep', test: 'assert len(agent.sources) >= 1\nassert all(s.items is not None for s in agent.sources)' },
  { id: 'GR-202', category: 'Knowledge & scope', weight: 3, detection: 'automated', title: 'Crawled scope ⊆ approved scope', check: 'Set difference between crawled source paths and owner-approved paths is empty.', evidence: 'Path-set diff report', test: 'assert set(crawled.paths) - set(approved.paths) == set()' },
  { id: 'GR-203', category: 'Knowledge & scope', weight: 2, detection: 'manual', title: 'No external / guest-shared content', check: 'Manual validation required: metadata alone cannot prove absence of externally shared or guest-accessible items in scope.', evidence: 'Reviewer sign-off note', test: 'manual: verify sharing links and guest\naccess for every in-scope source' },
  { id: 'GR-301', category: 'Permissions & exposure', weight: 3, detection: 'automated', title: 'Least-privilege permission grants', check: 'Granted Graph/SharePoint scopes are a subset of the documented requirement set.', evidence: 'App registration scope diff', test: 'assert set(granted.scopes) <= set(required.scopes)' },
  { id: 'GR-302', category: 'Permissions & exposure', weight: 3, detection: 'automated', title: 'No elevated site role for agent identity', check: 'Agent service principal is not a site owner and holds no FullControl grant.', evidence: 'Site permission snapshot', test: 'assert agent.spId not in site.owners\nassert maxRole(agent) < FullControl' },
  { id: 'GR-304', category: 'Permissions & exposure', weight: 2, detection: 'manual', title: 'Sensitivity-label reachability reviewed', check: 'Manual validation required: reviewer confirms whether Confidential/regulated labelled content is reachable from in-scope sources.', evidence: 'Label reachability worksheet', test: 'manual: walk label coverage for each\nin-scope library with the data owner' },
  { id: 'GR-401', category: 'Evaluation evidence', weight: 2, detection: 'automated', title: 'Response-quality fixture suite run', check: 'Quality fixture suite executed within 30 days with pass rate ≥ 95%.', evidence: 'Eval run record + fixture hashes', test: 'assert latest(suite=RQ).ageDays <= 30\nassert passRate >= 0.95' },
  { id: 'GR-402', category: 'Evaluation evidence', weight: 3, detection: 'automated', title: 'Access-boundary canary probes clean', check: 'Canary documents outside approved scope are never returned across 50 retrieval probes.', evidence: 'Canary probe log', test: 'assert canaryHits(probes=50) == 0' },
  { id: 'GR-403', category: 'Evaluation evidence', weight: 2, detection: 'automated', title: 'Escalation & refusal behaviour tested', check: 'Out-of-scope prompts escalate to the owner queue; refusals are logged, not hallucinated.', evidence: 'Escalation trace export', test: 'assert oos.escalated == len(oos.prompts)\nassert all(r.logged for r in refusals)' },
  { id: 'GR-501', category: 'Lifecycle & provenance', weight: 2, detection: 'automated', title: 'Review scheduled & in date', check: 'Next review date exists and is not in the past.', evidence: 'Registry schedule entry', test: 'assert agent.nextReview is not None\nassert agent.nextReview >= today' },
  { id: 'GR-502', category: 'Lifecycle & provenance', weight: 1, detection: 'automated', title: 'Audit provenance intact', check: 'Append-only audit chain verifies — every event hash links to its predecessor.', evidence: 'Hash-chain verification', test: 'assert verifyChain(agent.audit) is True' },
  { id: 'GR-601', category: 'Operational safety', weight: 1, detection: 'automated', title: 'Deterministic fallback on retrieval failure', check: 'Empty retrieval returns the canned fallback string — never a generated answer.', evidence: 'Fallback replay log', test: 'on retrieval.empty:\n  assert response == CANNED_FALLBACK' },
];
export const RULE_MAP: Record<string, GovRule> = Object.fromEntries(RULES.map(r => [r.id, r]));
export const CATEGORIES = [...new Set(RULES.map(r => r.category))];

// ─── scoring engine ───────────────────────────────────────────────────────────
export interface ScoreInfo { score: number; confidence: number; pass: number; fail: number; manual: number; na: number; band: 'assured' | 'provisional' | 'at-risk'; failing: string[]; }
export function scoreAgent(a: AgentRecord): ScoreInfo {
  let wT = 0, wE = 0, wC = 0, pass = 0, fail = 0, manual = 0, na = 0;
  const failing: string[] = [];
  for (const r of a.rules) {
    const rule = RULE_MAP[r.ruleId]; if (!rule) continue;
    if (r.state === 'na') { na++; continue; }
    wT += rule.weight;
    if (r.state === 'pass') { pass++; wE += rule.weight; }
    else if (r.state === 'manual') { manual++; wE += 0.4 * rule.weight; }
    else { fail++; failing.push(r.ruleId); }
    wC += rule.weight * (r.confidence === 'high' ? 1 : r.confidence === 'medium' ? 0.75 : 0.4);
  }
  const score = wT ? Math.round((100 * wE) / wT) : 0;
  const confidence = wT ? Math.round((100 * wC) / wT) : 0;
  const band = score >= 85 ? 'assured' : score >= 65 ? 'provisional' : 'at-risk';
  return { score, confidence, pass, fail, manual, na, band, failing };
}
export function agentStatus(a: AgentRecord, exceptions: ExceptionRec[]): AgentStatus {
  if (a.retired) return 'retired';
  const open = exceptions.filter(e => e.agentId === a.id && e.status !== 'closed');
  if (open.some(e => e.severity === 'high')) return 'exception';
  return scoreAgent(a).band;
}
export const BAND_LABEL: Record<string, string> = { assured: 'Assured', provisional: 'Provisional', 'at-risk': 'At risk', exception: 'Exception', retired: 'Retired' };

const rr = (ruleId: string, state: RuleState, confidence: Confidence, at: string, ref?: string, note?: string): RuleResult =>
  ({ ruleId, state, confidence, at, ref, note });
type Spec = { [k: string]: [RuleState, Confidence, string?, string?] | undefined };
function rulesFor(at: string, spec: Spec): RuleResult[] {
  return RULES.map(r => {
    const s = spec[r.id] ?? spec[r.id.replace('-', '_')];
    return s ? rr(r.id, s[0], s[1], at, s[2], s[3]) : rr(r.id, 'pass', 'high', at, 'EV-auto');
  });
}

// ─── seeded estate (dates relative to now) ────────────────────────────────────
export const SEED_AGENTS: AgentRecord[] = [
  {
    id: 'AG-001', name: 'HR Policy Assistant', env: '/sites/hr-policies · contoso-lab', owner: 'Priya Nair', ownerRole: 'HR Operations Lead',
    purpose: 'Answers employee questions on HR policy and benefits using only the approved HR policy hub; escalates casework to the HR service desk.',
    attestedBy: 'Priya Nair', attestedAt: day(-21), nextReview: day(69), lastEvaluated: day(-6),
    knowledge: [
      { name: 'HR Policy Hub', kind: 'SharePoint site', path: '/sites/hr-policies', items: 412, approved: true, crawled: day(-1) },
      { name: 'Benefits Library', kind: 'Document library', path: '/sites/hr/benefits', items: 96, approved: true, crawled: day(-1) },
    ],
    permissions: [
      { scope: 'Sites.Selected', granted: 'Sites.Selected', required: 'Sites.Selected', state: 'ok' },
      { scope: 'Files.Read (selected)', granted: 'Files.Read.Selected', required: 'Files.Read.Selected', state: 'ok' },
    ],
    rules: rulesFor(day(-6), {
      GR_101: undefined, GR_203: ['manual', 'low', undefined, 'Manual validation required — sharing review pending'],
      GR_304: ['manual', 'low', 'WS-118', 'Label worksheet in progress with data owner'],
    } as unknown as Spec),
    evaluations: [
      { id: 'EV-1140', kind: 'response-quality', suite: 'RQ-14 · HR fixture set', at: day(-6), cases: 60, passed: 59, ref: 'sha256:7c2f…a91' },
      { id: 'EV-1141', kind: 'access-boundary', suite: 'AB-07 · Canary boundary', at: day(-6), cases: 50, passed: 50, ref: 'sha256:0be4…77d' },
      { id: 'EV-1142', kind: 'escalation', suite: 'ES-03 · Escalation & refusal', at: day(-6), cases: 24, passed: 24, ref: 'sha256:f31c…c02' },
    ],
  },
  {
    id: 'AG-002', name: 'Procurement Q&A', env: '/sites/procurement · contoso-lab', owner: 'Daniel Okafor', ownerRole: 'Procurement Manager',
    purpose: 'Guides requesters through procurement FAQs and threshold rules from the approved FAQ library; routes contracts above threshold to legal.',
    attestedBy: 'Daniel Okafor', attestedAt: day(-33), nextReview: day(57), lastEvaluated: day(-2),
    knowledge: [
      { name: 'Procurement FAQs', kind: 'Document library', path: '/sites/procurement/faqs', items: 133, approved: true, crawled: day(-2) },
      { name: 'Procurement (all)', kind: 'SharePoint site', path: '/sites/procurement-all', items: 1284, approved: false, crawled: day(-2) },
    ],
    permissions: [
      { scope: 'Sites.Read.All', granted: 'Sites.Read.All', required: 'Sites.Selected', state: 'review' },
      { scope: 'User.Read', granted: 'User.Read', required: 'User.Read', state: 'ok' },
    ],
    rules: rulesFor(day(-2), {
      GR_202: ['fail', 'high', 'EV-1221', 'Crawled /sites/procurement-all — outside approved scope'],
      GR_301: ['fail', 'medium', 'EV-1230', 'Sites.Read.All exceeds documented requirement'],
      GR_203: ['manual', 'low', undefined, 'Manual validation required'],
      GR_304: ['manual', 'low', undefined, 'Manual validation required'],
    } as unknown as Spec),
    evaluations: [
      { id: 'EV-1218', kind: 'response-quality', suite: 'RQ-09 · Procurement fixtures', at: day(-9), cases: 40, passed: 38, ref: 'sha256:9a01…b3e' },
    ],
  },
  {
    id: 'AG-003', name: 'IT Helpdesk Triage', env: '/sites/itservices · contoso-lab', owner: 'Marta Kowalska', ownerRole: 'IT Service Owner',
    purpose: 'Triages inbound IT tickets against the service catalogue and KB, proposing known fixes and escalating incidents to the on-call queue.',
    attestedBy: 'Marta Kowalska', attestedAt: day(-12), nextReview: day(78), lastEvaluated: day(-11),
    knowledge: [
      { name: 'IT Service Catalogue', kind: 'SharePoint site', path: '/sites/itservices', items: 388, approved: true, crawled: day(-3) },
      { name: 'KB Articles', kind: 'Document library', path: '/sites/it/kb', items: 1932, approved: true, crawled: day(-3) },
    ],
    permissions: [
      { scope: 'Sites.Selected', granted: 'Sites.Selected', required: 'Sites.Selected', state: 'ok' },
      { scope: 'ChannelMessage.Send', granted: 'ChannelMessage.Send', required: 'ChannelMessage.Send', state: 'ok' },
    ],
    rules: rulesFor(day(-11), {
      GR_403: ['fail', 'medium', 'EV-1305', 'Escalation queue unverified for latest build'],
      GR_203: ['manual', 'low', undefined, 'Manual validation required'],
      GR_304: ['manual', 'low', undefined, 'Manual validation required'],
    } as unknown as Spec),
    evaluations: [
      { id: 'EV-1301', kind: 'response-quality', suite: 'RQ-11 · Helpdesk fixtures', at: day(-11), cases: 48, passed: 47, ref: 'sha256:44de…01f' },
      { id: 'EV-1302', kind: 'access-boundary', suite: 'AB-07 · Canary boundary', at: day(-11), cases: 50, passed: 50, ref: 'sha256:88aa…190' },
    ],
  },
  {
    id: 'AG-004', name: 'Finance Report Summariser', env: '/sites/finance · contoso-lab', owner: 'Hugo Lindqvist', ownerRole: 'Finance Systems Lead',
    purpose: 'Summarises monthly finance reports for the leadership pack from the approved reports library only; never answers outside reporting scope.',
    attestedBy: 'Hugo Lindqvist', attestedAt: day(-104), nextReview: day(-14), lastEvaluated: day(-63),
    knowledge: [
      { name: 'Finance Reports', kind: 'Document library', path: '/sites/finance/reports', items: 240, approved: true, crawled: day(-46) },
      { name: 'Board Packs', kind: 'Document library', path: '/sites/finance/board', items: 64, approved: true, crawled: day(-46) },
    ],
    permissions: [
      { scope: 'Sites.Selected', granted: 'Sites.Selected', required: 'Sites.Selected', state: 'ok' },
      { scope: 'Files.Read.All', granted: 'Files.Read.All', required: 'Files.Read.Selected', state: 'review' },
    ],
    rules: rulesFor(day(-63), {
      GR_103: ['fail', 'high', undefined, 'Attestation expired — 14 days overdue'],
      GR_201: ['fail', 'medium', undefined, 'Inventory 46 days old — beyond 30-day limit'],
      GR_401: ['fail', 'medium', undefined, 'No quality suite run in 63 days'],
      GR_402: ['fail', 'high', undefined, 'Boundary suite never executed'],
      GR_501: ['fail', 'high', undefined, 'Review 14 days overdue'],
      GR_203: ['manual', 'low', undefined, 'Manual validation required'],
      GR_304: ['manual', 'low', 'WS-121', 'High sensitivity — review prioritised'],
    } as unknown as Spec),
    evaluations: [
      { id: 'EV-1090', kind: 'response-quality', suite: 'RQ-06 · Finance fixtures', at: day(-63), cases: 45, passed: 40, ref: 'sha256:1d7c…ee4' },
    ],
  },
  {
    id: 'AG-005', name: 'Legal Contract Intake', env: '/sites/legal · contoso-lab', owner: 'Amara Diallo', ownerRole: 'Legal Ops Manager',
    purpose: 'Pre-screens contract intake requests against the approved template library and raises matter numbers; refers substantive questions to lawyers.',
    attestedBy: 'Amara Diallo', attestedAt: day(-40), nextReview: day(50), lastEvaluated: day(-16),
    knowledge: [
      { name: 'Contract Templates', kind: 'Document library', path: '/sites/legal/templates', items: 118, approved: true, crawled: day(-16) },
      { name: 'Matter Intake List', kind: 'SharePoint list', path: '/sites/legal/intake', items: 87, approved: true, crawled: day(-16) },
    ],
    permissions: [
      { scope: 'Sites.Selected', granted: 'Sites.Selected', required: 'Sites.Selected', state: 'ok' },
      { scope: 'User.Read', granted: 'User.Read', required: 'User.Read', state: 'ok' },
    ],
    rules: rulesFor(day(-16), {
      GR_202: ['manual', 'low', undefined, 'Connector returns library-level paths only — set check partial'],
      GR_301: ['manual', 'low', undefined, 'Scope export awaiting admin confirmation'],
      GR_601: ['fail', 'low', undefined, 'Fallback string not configured for empty retrieval'],
      GR_203: ['manual', 'low', undefined, 'Manual validation required'],
      GR_304: ['manual', 'low', undefined, 'Manual validation required'],
    } as unknown as Spec),
    evaluations: [
      { id: 'EV-1260', kind: 'response-quality', suite: 'RQ-12 · Legal fixtures', at: day(-16), cases: 32, passed: 31, ref: 'sha256:b2e9…4ab' },
    ],
  },
  {
    id: 'AG-006', name: 'Site Admin Copilot', env: '/sites/it-admin · contoso-lab', owner: 'ITPlatform@ (shared)', ownerRole: 'Platform Team',
    purpose: 'Answers SharePoint administration questions from platform runbooks and the admin wiki; intended for the internal platform team only.',
    attestedBy: 'Platform Team', attestedAt: day(-58), nextReview: day(32), lastEvaluated: day(-30),
    knowledge: [
      { name: 'Admin Runbooks', kind: 'Document library', path: '/sites/it-admin', items: 76, approved: true, crawled: day(-30) },
      { name: 'Tenant Config Wiki', kind: 'Wiki', path: '/sites/it-admin/wiki', items: 41, approved: true, crawled: day(-30) },
    ],
    permissions: [
      { scope: 'Sites.FullControl.All', granted: 'Sites.FullControl.All', required: 'Sites.Selected', state: 'breach' },
      { scope: 'User.Read', granted: 'User.Read', required: 'User.Read', state: 'ok' },
    ],
    rules: rulesFor(day(-30), {
      GR_101: ['fail', 'high', 'EV-1401', 'Owner resolves to shared mailbox ITPlatform@'],
      GR_302: ['fail', 'high', 'EV-1402', 'Agent identity present in Site Owners group'],
      GR_203: ['manual', 'low', undefined, 'Manual validation required'],
      GR_304: ['manual', 'low', undefined, 'Manual validation required'],
    } as unknown as Spec),
    evaluations: [],
  },
  {
    id: 'AG-007', name: 'Legacy Onboarding Bot', env: '/sites/hr/onboarding · contoso-lab', owner: 'Unassigned', ownerRole: 'Owner left organisation',
    purpose: 'Retired onboarding assistant. Retained in the register for provenance only — knowledge sources disconnected, permissions revoked.',
    attestedBy: '—', attestedAt: day(-200), nextReview: day(-120), lastEvaluated: day(-190), retired: true,
    knowledge: [{ name: 'Onboarding Docs', kind: 'Document library', path: '/sites/hr/onboarding', items: 152, approved: true, crawled: day(-190) }],
    permissions: [{ scope: 'Sites.Selected', granted: 'Revoked', required: '—', state: 'ok' }],
    rules: rulesFor(day(-190), {
      GR_101: ['na', 'low', undefined, 'Retired — no owner required'], GR_102: ['na', 'low', undefined, 'Retired'],
      GR_103: ['na', 'low', undefined, 'Retired'], GR_201: ['na', 'low', undefined, 'Sources disconnected'],
      GR_202: ['na', 'low', undefined, 'Sources disconnected'], GR_203: ['na', 'low', undefined, 'Retired'],
      GR_301: ['pass', 'high', 'EV-0990', 'Permissions revoked at retirement'], GR_302: ['pass', 'high', 'EV-0991', 'Removed from site roles'],
      GR_304: ['na', 'low', undefined, 'Retired'], GR_401: ['na', 'low', undefined, 'Retired'], GR_402: ['na', 'low', undefined, 'Retired'],
      GR_403: ['na', 'low', undefined, 'Retired'], GR_501: ['na', 'low', undefined, 'Retired'],
      GR_502: ['pass', 'high', undefined, 'Provenance archived'], GR_601: ['na', 'low', undefined, 'Retired'],
    } as unknown as Spec),
    evaluations: [],
  },
];

export const SEED_EXCEPTIONS: ExceptionRec[] = [
  {
    id: 'EX-101', agentId: 'AG-002', ruleId: 'GR-202', title: 'Knowledge scope exceeds approval — /sites/procurement-all crawled',
    severity: 'high', status: 'remediating', assignee: 'Daniel Okafor', openedAt: day(-9), dueBy: day(5),
    history: [
      { at: day(-9), by: 'Assurance engine', action: 'Opened — set difference non-empty on sweep EV-1221' },
      { at: day(-7), by: 'Daniel Okafor', action: 'Acknowledged — confirmed crawl misconfiguration' },
      { at: day(-2), by: 'Daniel Okafor', action: 'Remediation plan: restrict grounding to /faqs, request re-sweep' },
    ],
  },
  {
    id: 'EX-102', agentId: 'AG-004', ruleId: 'GR-103', title: 'Owner attestation expired — Finance Report Summariser',
    severity: 'medium', status: 'open', assignee: 'Hugo Lindqvist', openedAt: day(-14), dueBy: day(3),
    history: [{ at: day(-14), by: 'Assurance engine', action: 'Opened — attestation age 90+ days' }],
  },
  {
    id: 'EX-103', agentId: 'AG-004', ruleId: 'GR-402', title: 'Access-boundary canary suite never executed',
    severity: 'high', status: 'acknowledged', assignee: 'Hugo Lindqvist', openedAt: day(-14), dueBy: day(7),
    history: [
      { at: day(-14), by: 'Assurance engine', action: 'Opened — no AB suite record in evidence store' },
      { at: day(-10), by: 'Hugo Lindqvist', action: 'Acknowledged — fixture pack requested from lab' },
    ],
  },
  {
    id: 'EX-104', agentId: 'AG-006', ruleId: 'GR-101', title: 'Accountable owner is a shared mailbox',
    severity: 'medium', status: 'open', assignee: 'Platform Team', openedAt: day(-4), dueBy: day(10),
    history: [{ at: day(-4), by: 'Assurance engine', action: 'Opened — Entra resolution returned shared mailbox' }],
  },
  {
    id: 'EX-105', agentId: 'AG-006', ruleId: 'GR-302', title: 'Agent identity holds Site Owners membership',
    severity: 'high', status: 'open', assignee: 'Platform Team', openedAt: day(-4), dueBy: day(4),
    history: [{ at: day(-4), by: 'Assurance engine', action: 'Opened — permission snapshot shows FullControl path' }],
  },
  {
    id: 'EX-106', agentId: 'AG-001', ruleId: 'GR-301', title: 'Files.Read.All exceeded documented requirement',
    severity: 'medium', status: 'closed', assignee: 'Priya Nair', openedAt: day(-41), dueBy: day(-27), closedAt: day(-28),
    resolution: 'Replaced Files.Read.All with Sites.Selected plus an explicit site list; verified on sweep EV-1130.',
    history: [
      { at: day(-41), by: 'Assurance engine', action: 'Opened — granted scopes ⊄ required scopes' },
      { at: day(-36), by: 'Priya Nair', action: 'Acknowledged' },
      { at: day(-30), by: 'Priya Nair', action: 'Remediation applied in Entra app registration' },
      { at: day(-28), by: 'Assurance engine', action: 'Verified closed — scope diff now empty (EV-1130)' },
    ],
  },
];

export const SEED_AUDIT: AuditEntry[] = (() => {
  const rows: Omit<AuditEntry, 'chain'>[] = [
    { id: 'AU-090', at: day(-60), actor: 'Assurance engine', kind: 'system', action: 'Agent retired', target: 'AG-007', detail: 'Owner departed; sources disconnected, permissions revoked, provenance archived' },
    { id: 'AU-091', at: day(-30), actor: 'Assurance engine', kind: 'system', action: 'Rule pack activated', target: `pack ${RULE_PACK}`, detail: '15 deterministic rules, weighted scoring with confidence states' },
    { id: 'AU-092', at: day(-21), actor: 'Priya Nair', kind: 'user', action: 'Attestation refreshed', target: 'AG-001', detail: 'Purpose and ownership confirmed for 90-day window' },
    { id: 'AU-093', at: day(-15), actor: 'Teams connector', kind: 'connector', action: 'Review reminder sent', target: 'AG-004', detail: 'Attestation overdue — pinged Hugo Lindqvist' },
    { id: 'AU-094', at: day(-14), actor: 'Assurance engine', kind: 'system', action: 'Exceptions opened', target: 'AG-004', detail: 'EX-102 (GR-103), EX-103 (GR-402) raised on sweep' },
    { id: 'AU-095', at: day(-9), actor: 'Governance Admin', kind: 'user', action: 'Executive report exported', target: 'report', detail: 'CSV summary, portfolio score 78' },
    { id: 'AU-096', at: day(-8), actor: 'Priya Nair', kind: 'user', action: 'Evidence attached', target: 'EV-1130', detail: 'Sites.Selected grant export, hashed sha256:5f20…d11' },
    { id: 'AU-097', at: day(-6), actor: 'Eval connector', kind: 'connector', action: 'Fixture suites replayed', target: 'AG-001', detail: 'RQ-14 59/60 · AB-07 50/50 · ES-03 24/24' },
    { id: 'AU-098', at: day(-4), actor: 'Assurance engine', kind: 'system', action: 'Exceptions opened', target: 'AG-006', detail: 'EX-104 (GR-101), EX-105 (GR-302) raised on sweep' },
    { id: 'AU-099', at: day(-2), actor: 'Metadata connector', kind: 'connector', action: 'Sweep completed', target: 'tenant:contoso-lab', detail: '7 agents · 15 rules · metadata-only · 0 content reads' },
  ];
  let chain = 'genesis0';
  return rows.map(r => { chain = nextHash(chain, r.id + r.action + r.at); return { ...r, chain }; });
})();

export const SEED_CONNECTORS: Connector[] = [
  { id: 'graph', name: 'Microsoft Graph', role: 'Agent & app-registration inventory', mode: 'Metadata-only · read', scopes: ['Application.Read.All', 'User.Read'], enabled: true, status: 'connected' },
  { id: 'spo', name: 'SharePoint Metadata', role: 'Source paths, item counts, permission snapshots', mode: 'Metadata-only · read', scopes: ['Sites.Selected'], enabled: true, status: 'connected' },
  { id: 'eval', name: 'Evaluation Runner', role: 'Replays quality, canary and escalation fixtures', mode: 'Hashed prompts · no content stored', scopes: ['lab-sandbox'], enabled: true, status: 'connected' },
  { id: 'teams', name: 'Teams Reminders', role: 'Review reminders & owner pings', mode: 'Outbound webhook · no message read', scopes: ['ChannelMessage.Send'], enabled: true, status: 'connected' },
  { id: 'powerauto', name: 'Power Automate Hook', role: 'Approval flows for exceptions & attestations', mode: 'Outbound trigger · optional', scopes: ['approval.start'], enabled: false, status: 'configured' },
  { id: 'keyvault', name: 'Azure Key Vault', role: 'Secret storage for GA multi-tenancy', mode: 'Not provisioned in lab', scopes: [], enabled: false, status: 'offline' },
];

export const THREATS = [
  { threat: 'Prompt injection via indexed SharePoint content', likelihood: 'Medium', impact: 'High', control: 'GR-403 escalation tests · refusal logging · manual validation flags', status: 'Controls in place' },
  { threat: 'Over-broad knowledge grounding (scope creep)', likelihood: 'High', impact: 'High', control: 'GR-202 path-set difference on every sweep', status: '1 open finding' },
  { threat: 'Permission creep / elevated site access', likelihood: 'Medium', impact: 'High', control: 'GR-301/302 least-privilege diffs, quarterly recertification', status: '1 breach under remediation' },
  { threat: 'Ownership drift — owner leaves or hides behind shared mailbox', likelihood: 'High', impact: 'Medium', control: 'GR-101/103 attestation freshness + Teams reminders', status: '2 open findings' },
  { threat: 'Evidence tampering / lost provenance', likelihood: 'Low', impact: 'High', control: 'GR-502 append-only audit with hash chain', status: 'Chain verified' },
  { threat: 'Sensitivity-labelled content reachable by agent', likelihood: 'Medium', impact: 'High', control: 'GR-304 manual label-reachability review', status: 'Manual validation required' },
  { threat: 'Findings misread as AI-safety certification', likelihood: 'Medium', impact: 'Medium', control: 'Explicit evidence-not-certification framing in every report', status: 'By design' },
];

export const APP_PERMISSIONS = [
  { scope: 'Sites.Selected', api: 'Microsoft Graph', required: true, granted: true, why: 'Read metadata for enumerated agent sites only' },
  { scope: 'Application.Read.All', api: 'Microsoft Graph', required: true, granted: true, why: 'Enumerate agent app registrations (read)' },
  { scope: 'User.Read', api: 'Microsoft Graph', required: true, granted: true, why: 'Resolve owner identity for attestations' },
  { scope: 'ChannelMessage.Send', api: 'Microsoft Graph', required: true, granted: true, why: 'Teams review reminders to owners' },
  { scope: 'Files.Read.All', api: 'Microsoft Graph', required: false, granted: false, why: 'Not requested — metadata-only default' },
  { scope: 'Sites.FullControl.All', api: 'SharePoint', required: false, granted: false, why: 'Never requested by AgentGuard' },
];

export const PORTFOLIO_HISTORY = [71, 73, 72, 74, 76, 78, 79];
