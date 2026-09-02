import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { fmtDateTime, nextHash } from '../lib/data';
import { I, SectionHead } from '../components/ui';

export default function Audit() {
  const { audit } = useStore();
  const [kind, setKind] = useState<'all' | 'system' | 'user' | 'connector'>('all');
  const [verified, setVerified] = useState<null | { ok: boolean; count: number }>(null);

  const rows = useMemo(() => (kind === 'all' ? audit : audit.filter(e => e.kind === kind)).slice().reverse(), [audit, kind]);

  const verify = () => {
    let chain = 'genesis0';
    let ok = true;
    for (const e of audit) {
      chain = nextHash(chain, e.id + e.action + e.at);
      if (chain !== e.chain) { ok = false; break; }
    }
    setVerified({ ok, count: audit.length });
  };

  const kindTone: Record<string, string> = {
    system: 'bg-line-soft text-ink-soft', user: 'bg-pine-tint text-pine-deep', connector: 'bg-steel-tint text-steel',
  };
  const kindIcon: Record<string, string> = { system: 'shield', user: 'user', connector: 'plug' };

  return (
    <div className="p-6 max-w-[980px] mx-auto">
      <SectionHead
        kicker="Append-only · hash-chained"
        title="Audit trail"
        sub="Every attestation, sweep, exception move and export is chained to its predecessor. Tampering breaks verification — run it yourself."
        right={
          <button className={`btn-ghost ${verified?.ok === false ? 'border-red/60 text-red-deep' : ''}`} onClick={verify}>
            <I n={verified ? (verified.ok ? 'check' : 'alert') : 'lock'} s={15} />
            {verified ? (verified.ok ? `Chain intact · ${verified.count} entries` : 'Chain broken') : 'Verify chain'}
          </button>
        }
      />

      <div className="flex items-center gap-1.5 mb-4 reveal" style={{ animationDelay: '60ms' }}>
        {(['all', 'system', 'user', 'connector'] as const).map(k => (
          <button key={k} onClick={() => setKind(k)}
            className={`px-3 h-8 rounded-md text-[12.5px] font-medium capitalize transition-colors cursor-pointer border ${kind === k ? 'bg-pine-ink2 text-pine-tint border-pine-ink' : 'bg-card text-ink-soft border-line hover:border-pine/50'}`}>
            {k} <span className="ml-1 font-mono text-[10.5px] opacity-70">{k === 'all' ? audit.length : audit.filter(e => e.kind === k).length}</span>
          </button>
        ))}
        <span className="ml-auto text-[11.5px] text-ink-faint font-mono hidden sm:block">newest first · GR-502 input</span>
      </div>

      <div className="card overflow-hidden reveal" style={{ animationDelay: '100ms' }}>
        <div className="divide-y divide-line-soft">
          {rows.map((e, i) => (
            <div key={e.id} className="flex gap-3.5 px-4 py-3 hover:bg-pine-tint/20 transition-colors reveal" style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}>
              <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${kindTone[e.kind]}`}>
                <I n={kindIcon[e.kind]} s={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13.5px] font-semibold">{e.action}</span>
                  <span className="font-mono text-[11.5px] text-steel">{e.target}</span>
                </div>
                <div className="text-[12.5px] text-ink-soft mt-0.5">{e.detail}</div>
                <div className="font-mono text-[10.5px] text-ink-faint mt-1 flex items-center gap-2 flex-wrap">
                  <span>{fmtDateTime(e.at)}</span>·<span>{e.actor}</span>·<span className="text-pine-deep/80">chain 0x{e.chain}</span>
                </div>
              </div>
              <span className={`chip shrink-0 self-start ${kindTone[e.kind]}`}>{e.kind}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 mt-5 flex items-start gap-2.5 reveal" style={{ animationDelay: '160ms' }}>
        <span className="text-pine-deep mt-0.5"><I n="lock" s={16} /></span>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">Provenance over polish.</span> In the lab, the chain is an in-memory FNV-1a hash. The GA design moves to an Azure-hosted, time-stamped store — the evidence model and hash discipline stay identical, so nothing downstream needs rewriting.
        </p>
      </div>
    </div>
  );
}
