import { useState } from 'react';
import { useStore } from '../lib/store';
import { APP_PERMISSIONS, THREATS } from '../lib/data';
import { I, SectionHead, Tabs, Toggle } from '../components/ui';

export default function System() {
  const { connectors, toggleConnector } = useStore();
  const [tab, setTab] = useState('connectors');

  return (
    <div className="p-6 max-w-[1080px] mx-auto">
      <SectionHead
        kicker="Architecture guardrails"
        title="System, threat & privacy models"
        sub="The connector layer is deliberately replaceable — Microsoft's agent APIs will evolve, the domain model and evidence schema must not."
      />
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: 'connectors', label: 'Connectors', count: connectors.filter(c => c.enabled).length },
            { id: 'threat', label: 'Threat model', count: THREATS.length },
            { id: 'privacy', label: 'Privacy model' },
            { id: 'matrix', label: 'Permission matrix', count: APP_PERMISSIONS.length },
          ]}
          active={tab} onChange={setTab}
        />
      </div>

      {tab === 'connectors' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {connectors.map((c, i) => (
              <div key={c.id} className={`card p-4 reveal card-hover ${c.enabled ? '' : 'opacity-75'}`} style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${c.enabled ? 'bg-pine-tint text-pine-deep' : 'bg-line-soft text-ink-faint'}`}>
                      <I n="plug" s={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-semibold text-[14.5px]">{c.name}</span>
                        {c.enabled
                          ? <span className="chip-pine"><span className="w-1.5 h-1.5 rounded-full bg-pine pulse-dot" />{c.status}</span>
                          : <span className="chip-gray">{c.status}</span>}
                      </div>
                      <div className="text-[12.5px] text-ink-soft mt-0.5 leading-snug">{c.role}</div>
                      <div className="text-[11.5px] text-ink-faint mt-1.5 flex items-center gap-1.5"><I n="eye" s={12} />{c.mode}</div>
                      {c.scopes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.scopes.map(s => <span key={s} className="font-mono text-[10.5px] bg-line-soft text-ink-soft rounded px-1.5 py-0.5">{s}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <Toggle on={c.enabled} onClick={() => toggleConnector(c.id)} disabled={c.status === 'offline'} />
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4 flex items-start gap-2.5 reveal" style={{ animationDelay: '220ms' }}>
            <span className="text-pine-deep mt-0.5"><I n="info" s={16} /></span>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">Replaceable by contract, not by hope.</span> Each connector implements the same <span className="font-mono text-[11.5px]">inventory → metadata → evidence</span> contract. When Microsoft ships new agent surfaces (and it will), only the connector changes — rules, scores, exceptions and reports keep working. Disabled connectors downgrade their rules to <span className="chip-outline">Manual required</span> rather than failing silently.
            </p>
          </div>
        </div>
      )}

      {tab === 'threat' && (
        <div className="card overflow-hidden reveal">
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead><tr><th>Threat</th><th>Likelihood</th><th>Impact</th><th>Control</th><th>State</th></tr></thead>
              <tbody>
                {THREATS.map((t, i) => (
                  <tr key={t.threat} className="reveal" style={{ animationDelay: `${i * 40}ms` }}>
                    <td className="font-semibold text-[13px] max-w-[240px]">{t.threat}</td>
                    <td><Likelihood v={t.likelihood} /></td>
                    <td><Likelihood v={t.impact} /></td>
                    <td className="text-[12.5px] text-ink-soft max-w-[280px]">{t.control}</td>
                    <td>
                      <span className={`chip ${t.status.includes('Manual') ? 'chip-outline' : t.status.includes('open') || t.status.includes('breach') || t.status.includes('findings') ? 'bg-amber-tint text-amber-deep' : 'bg-pine-tint text-pine-deep'}`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-line text-[12px] text-ink-faint">Scoped honestly: prompt-injection testing stays in the sandboxed fixture runner — poorly-scoped live injection testing is itself a risk, so we never do it against production content.</div>
        </div>
      )}

      {tab === 'privacy' && (
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: 'eye', title: 'Metadata-only, by default', body: 'Collection is limited to paths, item counts, permission snapshots, app scopes and timestamps. Document bodies, prompts and completions never enter the assurance store — the eval runner hashes fixtures instead of storing them.' },
            { icon: 'lock', title: 'What we never store', body: 'Content copies. Prompt transcripts. User behaviour telemetry. Anything beyond owner identity needed for accountability — and that is directory metadata, already visible to tenant admins.' },
            { icon: 'calendar', title: 'Retention & residency', body: 'Lab data lives in the tenant region (UK South) and ages out after 12 months. Evidence references outlive the raw sweep; raw metadata does not outlive its review window.' },
            { icon: 'file', title: 'DPIA posture', body: 'A data-protection impact assessment template ships with every deployment. Low inherent risk: no new personal data is created, and every read is one a tenant admin could already make — we just write down that we made it.' },
          ].map((c, i) => (
            <div key={c.title} className="card p-5 reveal card-hover" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="w-9 h-9 rounded-md bg-pine-tint text-pine-deep flex items-center justify-center"><I n={c.icon} s={17} /></span>
                <h3 className="font-display font-semibold text-[15px]">{c.title}</h3>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-soft">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'matrix' && (
        <div className="space-y-4">
          <div className="card overflow-hidden reveal">
            <div className="overflow-x-auto">
              <table className="tbl w-full min-w-[700px]">
                <thead><tr><th>Scope</th><th>API</th><th>Required</th><th>Granted</th><th>Justification</th></tr></thead>
                <tbody>
                  {APP_PERMISSIONS.map((p, i) => (
                    <tr key={p.scope} className="reveal" style={{ animationDelay: `${i * 40}ms` }}>
                      <td className="font-mono text-[12px] font-semibold">{p.scope}</td>
                      <td className="text-[12.5px] text-ink-soft">{p.api}</td>
                      <td>{p.required ? <I n="check" s={15} w={2.2} c="text-pine-deep" /> : <I n="x" s={14} c="text-ink-faint" />}</td>
                      <td>{p.granted ? <span className="chip-pine"><I n="check" s={11} w={2.2} />granted</span> : <span className="chip-gray">not requested</span>}</td>
                      <td className="text-[12.5px] text-ink-soft max-w-[300px]">{p.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card p-4 flex items-start gap-2.5 reveal" style={{ animationDelay: '180ms' }}>
            <span className="text-steel mt-0.5"><I n="refresh" s={16} /></span>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">Recertification cadence:</span> the matrix is re-diffed against the live app registration on every sweep. Any granted scope not on this list fails GR-301 immediately and raises an exception — privilege drift has a very short half-life here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Likelihood({ v }: { v: string }) {
  const cls = v === 'High' ? 'bg-red-tint text-red-deep' : v === 'Medium' ? 'bg-amber-tint text-amber-deep' : 'bg-line-soft text-ink-soft';
  return <span className={`chip ${cls}`}>{v}</span>;
}
