import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { RuleState, AgentStatus } from '../lib/data';
import { BAND_LABEL } from '../lib/data';

// ─── inline icon set ──────────────────────────────────────────────────────────
const PATHS: Record<string, ReactNode> = {
  shield: <path d="M12 3l7 2.8v5.3c0 4.9-3.2 8.4-7 10.9-3.8-2.5-7-6-7-10.9V5.8L12 3z" />,
  shieldCheck: <><path d="M12 3l7 2.8v5.3c0 4.9-3.2 8.4-7 10.9-3.8-2.5-7-6-7-10.9V5.8L12 3z" /><path d="M8.8 12.2l2.3 2.3 4.3-4.6" /></>,
  ledger: <><path d="M8 6.5h12M8 12h12M8 17.5h12" /><circle cx="4" cy="6.5" r="0.9" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none" /><circle cx="4" cy="17.5" r="0.9" fill="currentColor" stroke="none" /></>,
  book: <><path d="M4 19.2A2.8 2.8 0 016.8 16.5H20V3.5H6.8A2.8 2.8 0 004 6.3v13z" /><path d="M20 16.5v4H6.8a2.8 2.8 0 01-2.8-2.8" /></>,
  alert: <><path d="M12 3.8L2.8 19.5h18.4L12 3.8z" /><path d="M12 10v4.2" /><circle cx="12" cy="16.8" r="0.4" fill="currentColor" /></>,
  file: <><path d="M13.5 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8.5L13.5 3z" /><path d="M13.5 3v5.5H19" /><path d="M9 13h6M9 16.5h6" /></>,
  receipt: <><path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4V3z" /><path d="M9.5 8h5M9.5 11.5h5" /></>,
  sliders: <><path d="M5 20v-6.5M5 9.5V4M12 20v-3M12 13V4M19 20v-8.5M19 7.5V4" /><path d="M2.8 13.5H7.2M9.8 13H14.2M16.8 11.5h4.4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20.5 20.5L15.8 15.8" /></>,
  chevD: <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />,
  chevR: <path d="M9.5 6.5l5.5 5.5-5.5 5.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  bell: <><path d="M6.3 9.5a5.7 5.7 0 1111.4 0c0 4.7 1.8 5.8 1.8 5.8H4.5s1.8-1.1 1.8-5.8z" /><path d="M10.2 19.3a2 2 0 003.6 0" /></>,
  send: <><path d="M21 3L10.5 13.5" /><path d="M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z" /></>,
  download: <><path d="M12 3.5V15M12 15l-4-4M12 15l4-4" /><path d="M4.5 20h15" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 11-2.5-6" /><path d="M20.5 3.5V8H16" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M16 3v4M8 3v4M3.5 10.5h17" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c.8-3.7 3.8-5.5 7.5-5.5s6.7 1.8 7.5 5.5" /></>,
  check: <path d="M5 13l4 4L19 7" />,
  lock: <><rect x="5" y="11" width="14" height="9.5" rx="1.5" /><path d="M8 11V7.5a4 4 0 018 0V11" /></>,
  plug: <><path d="M10 13.5a4.8 4.8 0 007.2.5l2.6-2.6a4.8 4.8 0 00-6.8-6.8l-1.5 1.5" /><path d="M14 10.5a4.8 4.8 0 00-7.2-.5l-2.6 2.6a4.8 4.8 0 006.8 6.8l1.5-1.5" /></>,
  eye: <><path d="M2.5 12S6.5 5 12 5s9.5 7 9.5 7-4 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="2.8" /></>,
  flask: <><path d="M9.5 3.5h5M10.5 3.5v5.2L4.8 18.6A1.8 1.8 0 006.4 21h11.2a1.8 1.8 0 001.6-2.4L13.5 8.7V3.5" /><path d="M7.5 15h9" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 16v-4.5" /><circle cx="12" cy="8.3" r="0.5" fill="currentColor" /></>,
  filter: <path d="M21 4.5H3l7 8.5v5.5l4 2V13l7-8.5z" />,
  arrowR: <><path d="M4.5 12h15M13.5 6l6 6-6 6" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  external: <><path d="M17.5 13.5V19a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 19V8A1.5 1.5 0 015 6.5h5.5" /><path d="M14.5 3.5H20.5V9.5" /><path d="M10.5 13.5L20 4" /></>,
  printer: <><path d="M7 8V3.5h10V8" /><rect x="4" y="8" width="16" height="8.5" rx="1.5" /><path d="M7 13.5h10v7H7z" /></>,
};
export function I({ n, s = 17, c = '', w = 1.6 }: { n: string; s?: number; c?: string; w?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden="true">
      {PATHS[n] ?? null}
    </svg>
  );
}

// ─── status + state chips ─────────────────────────────────────────────────────
export function StatusChip({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { cls: string; label: string }> = {
    assured: { cls: 'chip-pine', label: BAND_LABEL.assured },
    provisional: { cls: 'chip-amber', label: BAND_LABEL.provisional },
    'at-risk': { cls: 'chip-red', label: BAND_LABEL['at-risk'] },
    exception: { cls: 'chip-red', label: BAND_LABEL.exception },
    retired: { cls: 'chip-gray', label: BAND_LABEL.retired },
  };
  const m = map[status];
  return <span className={m.cls}>{status === 'exception' && <I n="alert" s={11} w={2} />}{m.label}</span>;
}

export function StateChip({ state }: { state: RuleState }) {
  if (state === 'pass') return <span className="chip-pine"><I n="check" s={11} w={2.2} />Pass</span>;
  if (state === 'fail') return <span className="chip-red"><I n="x" s={11} w={2.2} />Fail</span>;
  if (state === 'manual') return <span className="chip-outline">Manual required</span>;
  return <span className="chip-gray">N/A</span>;
}

export function ConfDots({ level }: { level: 'high' | 'medium' | 'low' }) {
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-[3px]" title={`Confidence: ${level}`}>
      {[0, 1, 2].map(i => (
        <span key={i} className={`w-[7px] h-[7px] rounded-full ${i < n ? (level === 'low' ? 'bg-amber' : 'bg-pine') : 'bg-line'}`} />
      ))}
    </span>
  );
}

// ─── score ring ───────────────────────────────────────────────────────────────
const BAND_COLOR: Record<string, string> = { assured: 'var(--color-pine)', provisional: 'var(--color-amber)', 'at-risk': 'var(--color-red)', retired: '#9aa79e' };
export function ScoreRing({ value, band, size = 58, stroke = 5.5, label }: { value: number; band: string; size?: number; stroke?: number; label?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t); }, []);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = mounted ? c * (1 - value / 100) : c;
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BAND_COLOR[band] ?? 'var(--color-pine)'}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="ring-anim" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-mono font-semibold" style={{ fontSize: size * 0.26, color: BAND_COLOR[band] }}>{value}</span>
        {label && <span className="text-[8.5px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-[6px] w-24 rounded-full bg-line-soft overflow-hidden">
        <div className="h-full rounded-full bg-steel grow-bar" style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[11px] text-ink-soft">{value}%</span>
    </div>
  );
}

export function Spark({ points, w = 148, h = 40 }: { points: number[]; w?: number; h?: number }) {
  const min = Math.min(...points) - 4, max = Math.max(...points) + 4;
  const pts = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / (max - min)) * h}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="var(--color-pine)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={h - ((last - min) / (max - min)) * h} r="3" fill="var(--color-pine)" stroke="var(--color-card)" strokeWidth="1.5" />
    </svg>
  );
}

// ─── layout atoms ─────────────────────────────────────────────────────────────
export function SectionHead({ kicker, title, right, sub }: { kicker: string; title: string; right?: ReactNode; sub?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <div className="kicker">{kicker}</div>
        <h2 className="font-display font-bold text-[22px] leading-tight mt-1">{title}</h2>
        {sub && <p className="text-[13px] text-ink-soft mt-1 max-w-xl">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-line overflow-x-auto">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`relative px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${active === t.id ? 'text-pine-deep' : 'text-ink-soft hover:text-ink'}`}>
          {t.label}
          {t.count !== undefined && <span className={`ml-1.5 font-mono text-[10.5px] px-1 rounded ${active === t.id ? 'bg-pine-tint text-pine-deep' : 'bg-line-soft text-ink-soft'}`}>{t.count}</span>}
          {active === t.id && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full bg-pine" />}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 480 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-pine-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative card shadow-lift reveal w-full max-h-[88vh] overflow-y-auto" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line sticky top-0 bg-card z-10">
          <h3 className="font-display font-semibold text-[15px]">{title}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink transition-colors cursor-pointer" aria-label="Close"><I n="x" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block mb-3.5">
      <span className="block font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] text-ink-faint mt-1">{hint}</span>}
    </label>
  );
}

export function Initials({ name, size = 30 }: { name: string; size?: number }) {
  const parts = name.replace(/[()@,]/g, ' ').split(/[\s.]+/).filter(Boolean);
  const init = (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '');
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-pine-tint text-pine-deep font-semibold border border-pine/25 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {init.toUpperCase()}
    </span>
  );
}

export function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0 disabled:opacity-40 ${on ? 'bg-pine' : 'bg-line'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}
