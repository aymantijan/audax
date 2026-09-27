import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { History, Link2, GraduationCap, HeartPulse, Wallet, TrendingUp, Flame, Info } from 'lucide-react';
import { useAccountingStore } from '../store/accountingStore';
import { buildEvents, DOMAINS, MIN_DAYS } from '../utils/life-timeline';
import { useTimelineData, useLifeLinks, LinksList } from '../components/today/LifeLinks';
import { formatMoney } from '../utils/currency';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, EmptyState } from '../components/common/ui';

const ICONS = { etudes: GraduationCap, sante: HeartPulse, argent: Wallet, trading: TrendingUp, habitudes: Flame };
const PERIODS = [{ key: 7, label: '7 jours' }, { key: 30, label: '30 jours' }, { key: 90, label: '3 mois' }, { key: 0, label: 'Tout' }];
const PAGE = 150;

export default function Timeline() {
  const [params, setParams] = useSearchParams();
  const view = params.get('vue') === 'liens' ? 'liens' : 'frise';
  const [domain, setDomain] = useState(null);
  const [period, setPeriod] = useState(30);
  const [shown, setShown] = useState(PAGE);
  const data = useTimelineData();
  const base = useAccountingStore((s) => s.baseCurrency);
  const money = (n, cur) => formatMoney(n, cur || base);
  const events = useMemo(() => buildEvents(data, { money }), [data, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const links = useLifeLinks();

  const from = period ? (() => { const d = new Date(); d.setDate(d.getDate() - period + 1); return todayKey(d); })() : '';
  const list = events.filter((e) => (!domain || e.domain === domain) && (!from || e.date >= from));
  const byDay = [];
  for (const e of list.slice(0, shown)) {
    const last = byDay[byDay.length - 1];
    if (last?.date === e.date) last.items.push(e); else byDay.push({ date: e.date, items: [e] });
  }
  const setView = (v) => { const p = new URLSearchParams(params); if (v === 'liens') p.set('vue', 'liens'); else p.delete('vue'); setParams(p, { replace: true }); };
  const chip = (active) => `rounded-full px-3 py-1 text-xs border cursor-pointer ${active ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2"><History size={22} /> Chronologie</h1>
        <p className="text-sm text-mute">Tout ce que tu notes, sur une seule ligne du temps, et les liens entre tes domaines.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={chip(view === 'frise')} onClick={() => setView('frise')}><History size={12} className="inline mr-1" />Frise</button>
        <button type="button" className={chip(view === 'liens')} onClick={() => setView('liens')}><Link2 size={12} className="inline mr-1" />Liens ({links.findings.length})</button>
      </div>

      {view === 'frise' ? (
        <Card>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" className={chip(!domain)} onClick={() => setDomain(null)}>Tout</button>
            {Object.entries(DOMAINS).map(([k, d]) => (
              <button key={k} type="button" className={chip(domain === k)} onClick={() => setDomain(domain === k ? null : k)}>{d.label}</button>
            ))}
            <span className="w-px bg-line mx-1" />
            {PERIODS.map((p) => <button key={p.key} type="button" className={chip(period === p.key)} onClick={() => { setPeriod(p.key); setShown(PAGE); }}>{p.label}</button>)}
          </div>
          {byDay.length ? (
            <div className="space-y-4">
              {byDay.map((g) => (
                <section key={g.date}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-mute mb-1.5">{g.date === todayKey() ? 'Aujourd’hui' : fmtDateShort(g.date)}</h2>
                  <ul className="space-y-1">
                    {g.items.map((e) => {
                      const Icon = ICONS[e.domain];
                      return (
                        <li key={e.id}>
                          <Link to={e.to} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface text-sm">
                            <Icon size={14} className="shrink-0 text-accent" />
                            <span className="flex-1 min-w-0 truncate text-ink">{e.title}</span>
                            <span className="font-data text-xs whitespace-nowrap" style={{ color: e.amount > 0 ? 'var(--success)' : e.amount < 0 ? 'var(--error)' : 'var(--text-secondary)' }}>{e.detail}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {list.length > shown && <button type="button" className="text-xs text-accent hover:underline cursor-pointer" onClick={() => setShown((n) => n + PAGE)}>Voir plus ({list.length - shown})</button>}
            </div>
          ) : <EmptyState>Rien de noté sur cette période. Utilise le bouton + pour noter une dépense, une séance, ton sommeil…</EmptyState>}
        </Card>
      ) : (
        <>
          <Card title={<span className="flex items-center gap-2"><Link2 size={15} /> Ce que tes données montrent</span>}>
            {links.findings.length ? <LinksList links={links} /> : (
              <p className="text-sm text-mute">Pas encore assez de jours pour comparer. Il faut au moins {MIN_DAYS} jours « avec » et {MIN_DAYS} jours « sans » et un écart net ; continue à noter ton sommeil, ton sport, tes révisions et tes dépenses.</p>
            )}
            <p className="flex items-start gap-1.5 text-[11px] text-mute mt-3"><Info size={12} className="mt-0.5 shrink-0" /> Un lien observé sur tes propres jours, pas une cause prouvée : d’autres choses jouent aussi. Clique sur un constat pour voir les jours comparés. Tout est calculé sur ton appareil.</p>
          </Card>
          {links.waiting.length > 0 && (
            <Card title="En attente de données">
              <ul className="space-y-1.5 text-sm text-mute">{links.waiting.map((w) => <li key={w.key}>{w.text}</li>)}</ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
