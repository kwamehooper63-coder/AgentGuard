import { StoreProvider, useStore, openExceptions } from './lib/store';
import type { ViewId } from './lib/store';
import { RULE_PACK, fmtTime } from './lib/data';
import { I } from './components/ui';
import Registry from './views/Registry';
import AgentDetail from './views/AgentDetail';
import Rules from './views/Rules';
import Exceptions from './views/Exceptions';
import Reports from './views/Reports';
import Audit from './views/Audit';
import System from './views/System';

const SCAN_STEPS = [
  'Enumerating agents via Microsoft Graph…',
  'Reading SharePoint source metadata (read-only)…',
  'Replaying evaluation fixtures…',
  'Recomputing assurance scores…',
];

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { view, setView, exceptions, activeId, scanning, scanStep, runScan, lastSweepAt, toasts, connectors } = useStore();
  const open = openExceptions(exceptions).length;
  const connected = connectors.filter(c => c.enabled).length;

  const nav: { id: ViewId; label: string; icon: string; badge?: number; badgeTone?: string }[] = [
    { id: 'registry', label: 'Assurance ledger', icon: 'ledger' },
    { id: 'rules', label: 'Rule catalogue', icon: 'book' },
    { id: 'exceptions', label: 'Exceptions', icon: 'alert', badge: open, badgeTone: open ? 'bg-red text-red-tint' : undefined },
    { id: 'reports', label: 'Reports', icon: 'file' },
    { id: 'audit', label: 'Audit trail', icon: 'receipt' },
    { id: 'system', label: 'System & models', icon: 'sliders' },
  ];

  const titles: Record<ViewId, [string, string]> = {
    registry: ['Assurance Ledger', 'Application-level register · metadata-only'],
    rules: ['Rule Catalogue', `${RULE_PACK} · deterministic checks`],
    exceptions: ['Exceptions', 'Remediation workflow'],
    reports: ['Reports', 'Executive & technical artefacts'],
    audit: ['Audit Trail', 'Append-only provenance'],
    system: ['System & Models', 'Connectors · threat · privacy · permissions'],
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* sidebar */}
      <aside className="w-[228px] shrink-0 bg-pine-ink text-pine-tint/85 flex flex-col no-print">
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-pine-deep flex items-center justify-center text-pine-tint shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <I n="shieldCheck" s={20} w={1.8} />
          </span>
          <div className="leading-tight">
            <div className="font-display font-bold text-[15.5px] text-pine-tint tracking-tight">AgentGuard <span className="text-pine/90">365</span></div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-pine-tint/50">Agent assurance</div>
          </div>
        </div>

        <div className="mx-4 mb-3 h-px bg-pine-tint/10" />

        <nav className="px-3 space-y-0.5 flex-1">
          {nav.map(n => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-[13.5px] font-medium transition-all duration-150 cursor-pointer ${view === n.id ? 'bg-pine-deep/60 text-pine-tint shadow-[inset_2px_0_0_var(--color-pine)]' : 'text-pine-tint/60 hover:text-pine-tint hover:bg-pine-tint/5'}`}>
              <I n={n.icon} s={16} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.badge !== undefined && n.badge > 0 && <span className={`font-mono text-[10.5px] px-1.5 py-0.5 rounded ${n.badgeTone ?? 'bg-pine-tint/15 text-pine-tint/80'}`}>{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4">
          <div className="rounded-lg bg-pine-tint/[0.06] border border-pine-tint/12 p-3.5">
            <div className="flex items-center gap-2 mb-1.5 text-amber-tint/90">
              <I n="alert" s={13} w={2} />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em]">Read me</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-pine-tint/65">
              Findings are <span className="text-pine-tint/90 font-medium">governance evidence — not AI-safety certification</span>. Manual rules say so. Scores carry confidence states.
            </p>
          </div>
          <div className="mt-3 px-1 font-mono text-[10px] text-pine-tint/40">
            lab build 0.4 · {RULE_PACK}<br />SharePoint-list persistence · least privilege
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[58px] shrink-0 bg-card/85 backdrop-blur border-b border-line flex items-center gap-3 px-5 no-print">
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] leading-none">{titles[view][0]}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mt-1">{titles[view][1]}</div>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="chip-gray hidden md:inline-flex"><span className={`w-1.5 h-1.5 rounded-full ${scanning ? 'bg-amber pulse-dot' : 'bg-pine'}`} />{scanning ? 'sweep running' : `last sweep ${fmtTime(lastSweepAt)}`}</span>
            <span className="chip-steel hidden lg:inline-flex"><I n="eye" s={11} />metadata-only</span>
            <span className="chip-gray hidden lg:inline-flex"><I n="plug" s={11} />{connected} connectors</span>

            <button onClick={runScan} disabled={scanning} className="btn-dark h-9 relative overflow-hidden min-w-[132px]">
              {scanning ? (
                <>
                  <span className="absolute inset-y-0 w-10 bg-pine-tint/15 scan-line rounded" />
                  <span className="spin inline-flex"><I n="refresh" s={15} /></span>
                  <span className="truncate max-w-[150px] text-[12.5px]">{SCAN_STEPS[Math.min(scanStep, SCAN_STEPS.length - 1)]}</span>
                </>
              ) : (
                <><I n="refresh" s={15} />Run sweep</>
              )}
            </button>

            <div className="w-px h-6 bg-line mx-0.5" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-pine text-pine-tint flex items-center justify-center text-[11.5px] font-semibold border border-pine-deep">GA</span>
              <div className="hidden md:block leading-tight">
                <div className="text-[12.5px] font-semibold">Governance Admin</div>
                <div className="font-mono text-[10px] text-ink-faint">contoso-lab · tenant</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={view} className="reveal">
            {view === 'registry' && <Registry />}
            {view === 'rules' && <Rules />}
            {view === 'exceptions' && <Exceptions />}
            {view === 'reports' && <Reports />}
            {view === 'audit' && <Audit />}
            {view === 'system' && <System />}
          </div>
          <footer className="px-6 pb-6 pt-2 text-center font-mono text-[10.5px] text-ink-faint no-print">
            AgentGuard 365 · independent application assurance for SharePoint &amp; M365 agents · complements — never replaces — Microsoft tenant governance
          </footer>
        </main>
      </div>

      {activeId && <AgentDetail />}

      {/* toasts */}
      <div className="fixed bottom-5 right-5 z-[60] space-y-2 no-print">
        {toasts.map(t => (
          <div key={t.id} className={`toast-in flex items-center gap-2.5 rounded-md border shadow-lift bg-card pl-3 pr-4 py-2.5 text-[13px] font-medium max-w-[380px] ${t.tone === 'red' ? 'border-red/50' : t.tone === 'amber' ? 'border-amber/50' : 'border-pine/50'}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${t.tone === 'red' ? 'bg-red' : t.tone === 'amber' ? 'bg-amber' : 'bg-pine'}`} />
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
