import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { CATEGORIES, RULES, RULE_PACK } from '../lib/data';
import { I, SectionHead, StateChip } from '../components/ui';

export default function Rules() {
  const { agents } = useStore();
  const [expanded, setExpanded] = useState<string | null>('GR-202');
  const active = agents.filter(a => !a.retired);

  const estate = useMemo(() => RULES.map(rule => {
    let pass = 0, fail = 0, manual = 0, na = 0;
    active.forEach(a => {
      const r = a.rules.find(x => x.ruleId === rule.id);
      if (!r || r.state === 'na') { na++; return; }
      if (r.state === 'pass') pass++; else if (r.state === 'fail') fail++; else manual++;
    });
    const assessed = pass + fail + manual || 1;
    return { rule, pass, fail, manual, na, rate: Math.round((100 * pass) / assessed) };
  }), [active]);

  const automated = RULES.filter(r => r.detection === 'automated').length;
  const manualRules = RULES.filter(r => r.detection === 'manual').length;

  return (
    <div className="p-6 max-w-[1240px] mx-auto">
      <SectionHead
        kicker={`Rule pack ${RULE_PACK} · weighted & versioned`}
        title="Deterministic governance rules"
        sub="Every finding is a reproducible check with named evidence — never an opaque model verdict. Manual rules say so explicitly."
        right={<span className="chip-steel">{RULES.length} rules · {automated} automated · {manualRules} manual</span>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_300px] items-start">
        <div className="space-y-6">
          {CATEGORIES.map((cat, ci) => (
            <div key={cat} className="reveal" style={{ animationDelay: `${ci * 60}ms` }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="kicker">{cat}</div>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="card overflow-hidden divide-y divide-line-soft">
                {estate.filter(({ rule }) => rule.category === cat).map(({ rule, pass, fail, manual, rate }) => {
                  const open = expanded === rule.id;
                  return (
                    <div key={rule.id}>
                      <button onClick={() => setExpanded(open ? null : rule.id)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${open ? 'bg-pine-tint/50' : 'hover:bg-pine-tint/25'}`}>
                        <span className="font-mono text-[11.5px] text-ink-soft w-[62px] shrink-0">{rule.id}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-semibold leading-tight">{rule.title}</span>
                          <span className="block text-[11.5px] text-ink-faint mt-0.5">weight {rule.weight} · {rule.detection}{rule.detection === 'manual' ? ' — manual validation required' : ''}</span>
                        </span>
                        <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[10.5px] text-ink-faint w-14 text-right">{pass}✓ {fail}✗ {manual}⚠</span>
                          <span className="h-[6px] w-20 rounded-full bg-line-soft overflow-hidden hidden md:block">
                            <span className={`block h-full grow-bar ${rate >= 85 ? 'bg-pine' : rate >= 60 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${rate}%` }} />
                          </span>
                        </span>
                        {rule.detection === 'manual' && <span className="chip-outline shrink-0 hidden sm:inline-flex">Manual</span>}
                        <span className="text-ink-faint transition-transform duration-200 shrink-0" style={{ transform: open ? 'rotate(180deg)' : 'none' }}><I n="chevD" s={15} /></span>
                      </button>
                      {open && (
                        <div className="px-4 pb-4 pt-1 grid md:grid-cols-[1fr_280px] gap-4 reveal">
                          <div>
                            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1">Deterministic check</div>
                            <p className="text-[13px] leading-relaxed text-ink-soft mb-3">{rule.check}</p>
                            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1">Evidence required</div>
                            <p className="text-[13px] text-ink-soft">{rule.evidence}</p>
                          </div>
                          <div>
                            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint mb-1">Rule test</div>
                            <pre className="bg-pine-ink text-pine-tint/90 rounded-md p-3 font-mono text-[11.5px] leading-relaxed overflow-x-auto">{rule.test}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* side rail */}
        <div className="space-y-5 xl:sticky xl:top-4">
          <div className="card p-4 reveal" style={{ animationDelay: '120ms' }}>
            <div className="kicker mb-3">Scoring model</div>
            <div className="space-y-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              <p><span className="chip-pine mr-1.5">Pass</span>earns full rule weight.</p>
              <p><span className="chip-outline mr-1.5">Manual</span>earns 40% at low confidence until sign-off.</p>
              <p><span className="chip-red mr-1.5">Fail</span>earns nothing and raises an exception.</p>
              <p><span className="chip-gray mr-1.5">N/A</span>is excluded from the denominator.</p>
            </div>
            <div className="mt-3 pt-3 border-t border-line-soft font-mono text-[11.5px] text-ink">
              score = Σ(earned weight) / Σ(assessed weight) × 100
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink-faint">Bands: ≥85 assured · 65–84 provisional · &lt;65 at risk</div>
          </div>
          <div className="card p-4 reveal" style={{ animationDelay: '180ms' }}>
            <div className="kicker mb-3">Confidence states</div>
            <div className="space-y-2 text-[12.5px] text-ink-soft">
              <div className="flex items-center gap-2"><Dots n={3} tone="pine" /><span><span className="font-medium text-ink">High</span> — automated check, fresh evidence</span></div>
              <div className="flex items-center gap-2"><Dots n={2} tone="pine" /><span><span className="font-medium text-ink">Medium</span> — attestation or ageing evidence</span></div>
              <div className="flex items-center gap-2"><Dots n={1} tone="amber" /><span><span className="font-medium text-ink">Low</span> — manual validation required</span></div>
            </div>
          </div>
          <div className="card p-4 border-red/35 bg-red-tint/40 reveal" style={{ animationDelay: '240ms' }}>
            <div className="flex items-start gap-2.5">
              <span className="text-red-deep mt-0.5"><I n="alert" s={16} w={2} /></span>
              <p className="text-[12.5px] leading-relaxed">
                <span className="font-semibold">What this pack never claims.</span> A pass is governance evidence about ownership, scope, permissions and tested behaviour — <span className="font-semibold">not</span> complete safety, and never hallucination prevention. Say so in every artefact you ship.
              </p>
            </div>
          </div>
          <div className="card p-4 reveal" style={{ animationDelay: '300ms' }}>
            <div className="kicker mb-3">Estate snapshot</div>
            <div className="space-y-1.5">
              {estate.filter(x => x.fail > 0).sort((a, b) => b.fail - a.fail).slice(0, 5).map(({ rule, fail }) => (
                <div key={rule.id} className="flex items-center justify-between text-[12px]">
                  <span className="font-mono text-ink-soft">{rule.id}</span>
                  <span className="truncate mx-2 text-ink-soft">{rule.title}</span>
                  <StateChip state="fail" />
                </div>
              ))}
              <div className="text-[11px] text-ink-faint pt-1.5 border-t border-line-soft mt-2">Rules with live failures across active agents</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dots({ n, tone }: { n: number; tone: 'pine' | 'amber' }) {
  return (
    <span className="inline-flex items-center gap-[3px] shrink-0">
      {[0, 1, 2].map(i => <span key={i} className={`w-[7px] h-[7px] rounded-full ${i < n ? (tone === 'amber' ? 'bg-amber' : 'bg-pine') : 'bg-line'}`} />)}
    </span>
  );
}
