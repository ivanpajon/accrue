"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChartNoAxesCombined, CircleHelp, DollarSign, Download, Euro, Info, Layers3, Languages, Monitor, Moon, Sun, Plus, RotateCcw, TrendingUp, Wallet, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateProjection, contributionGaps, phaseRanges, validPhase, type Phase } from '@/lib/compound';
import { locales, translator, type MessageKey } from '@/lib/i18n';
import { usePreferences } from '@/lib/store';
import { ConfigurationContext, SavedConfigurations } from '@/components/saved-configurations';
import { ContributionPhase } from '@/components/contribution-phase';
import { STORAGE_KEY, type Preferences } from '@/lib/preferences';

const phaseColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
function Choice({ value, onChange, options, label, id, icon, iconOnly = false, className = '' }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string; id?: string; icon?: ReactNode; iconOnly?: boolean; className?: string }) {
  const trigger = <SelectTrigger id={id} aria-label={label} showChevron={!iconOnly} className={`${iconOnly?'icon-choice':'choice'} ${className}`}>{icon}{iconOnly ? <span className="sr-only"><SelectValue /></span> : <SelectValue />}</SelectTrigger>;
  return <Select value={value} onValueChange={onChange}>{iconOnly ? <Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent sideOffset={8}>{label}: {options.find(option=>option.value===value)?.label}</TooltipContent></Tooltip> : trigger}<SelectContent position="popper" align={iconOnly?'end':'center'}><SelectGroup>{iconOnly && <SelectLabel>{label}</SelectLabel>}{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select>;
}
function NumberField({ id, label, accessibleLabel, value, onChange, prefix, suffix, min = 0, max = 1e9, step = 'any', commitOnBlur = false }: { id: string; label: string; accessibleLabel?: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; min?: number; max?: number; step?: string; commitOnBlur?: boolean }) {
  const [draft,setDraft] = useState<string | null>(null);
  const inputValue = commitOnBlur ? draft ?? value : value;
  const invalid = inputValue.trim() === '' || !Number.isFinite(Number(inputValue)) || Number(inputValue) < min || Number(inputValue) > max || (step === '1' && !Number.isInteger(Number(inputValue)));
  return <div className="field"><Label htmlFor={id}>{label}</Label><div className={`number-wrap ${invalid ? 'invalid' : ''}`}>{prefix && <span className="prefix">{prefix}</span>}<Input id={id} type="number" inputMode={step === '1' ? 'numeric' : 'decimal'} aria-label={accessibleLabel} value={inputValue} min={min} max={max} step={step} onChange={event => commitOnBlur ? setDraft(event.target.value) : onChange(event.target.value)} onBlur={()=>{if(commitOnBlur && draft!==null){onChange(draft);setDraft(null);}}} onKeyDown={event=>{if(commitOnBlur && event.key==='Enter')event.currentTarget.blur();}} aria-invalid={invalid} className={prefix ? 'with-prefix' : ''} />{suffix && <span className="suffix">{suffix}</span>}</div></div>;
}

export default function Home() {
  const { initial, rate, compounds, years, phases, currency, timing, view, visible, language, theme, update, resetPlan, activeConfigId, savedConfigs } = usePreferences();
  const editingConfiguration = savedConfigs.some(item=>item.id===activeConfigId);
  // Every preview in one drag starts from the original phases, not the last clipped preview.
  const periodDrag = useRef<{phases:Phase[] | null} | null>(null);
  const changePeriodFromSlider = (value:number[]) => {
    const currentPhases = usePreferences.getState().phases;
    // Radix focuses the thumb before this callback, committing any pending number-field edit.
    if (periodDrag.current && !periodDrag.current.phases) periodDrag.current.phases = currentPhases;
    update({years:String(value[0]),phases:periodDrag.current?.phases ?? currentPhases});
  };
  const t = useMemo(() => translator(language), [language]);
  const locale = locales[language];
  useEffect(() => {
    void usePreferences.persist.rehydrate();
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) void usePreferences.persist.rehydrate(); };
    window.addEventListener('storage',sync);
    return () => window.removeEventListener('storage',sync);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || theme === 'system' && media.matches;
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.classList.toggle('light', !dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    // Hydration may synchronously update the store before this first effect runs.
    if (usePreferences.getState().theme === theme) apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));
  }, [language, t]);
  const symbol = currency === 'EUR' ? '€' : '$';
  const money = (value: number, digits = 0) => new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const compactMoney = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const metricMoney = (value: number) => Math.abs(value) >= 1e8 ? compactMoney(value) : money(value);
  const number = (value: number, digits = 0) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const percent = (value: number, digits = 1, signed = false) => new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: signed ? 'exceptZero' : 'auto' }).format(value);
  const duration = (count: number) => t(count === 1 ? 'yearCount' : 'yearsCount', { count: number(count) });
  const rangeLabel = (start: number, end: number) => start === end ? t('yearSingle', { year: number(start) }) : t('yearRange', { start: number(start), end: number(end) });
  const perPeriod: Record<string, MessageKey> = { '12':'perMonth', '52':'perWeek', '26':'perFortnight', '4':'perQuarter', '2':'perHalfYear', '1':'perYear' };
  const validAmount = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1e9;
  const validRate = rate.trim() !== '' && Number.isFinite(Number(rate)) && Number(rate) >= -50 && Number(rate) <= 100;
  const valid = validAmount(initial) && validRate && Number.isInteger(Number(years)) && Number(years) >= 1 && Number(years) <= 50 && phases.every(validPhase);
  const rows = useMemo(() => valid ? calculateProjection(Number(initial), Number(rate), Number(compounds), Number(years), phases, timing) : [], [initial, rate, compounds, years, phases, timing, valid]);
  const final = rows.at(-1);
  const ranges = phaseRanges(phases, Number(years) || 0);
  const gaps = valid ? contributionGaps(phases, Number(years)) : [];
  const overlap = phases.some((p, i) => Number(p.amount) > 0 && phases.slice(i + 1).some(q => Number(q.amount) > 0 && Math.max(Number(p.startYear), Number(q.startYear)) <= Math.min(Number(p.endYear), Number(q.endYear), Number(years))));
  const growthShare = final && final.total > 0 ? Math.max(0, final.gains) / final.total : 0;
  const donutBase = final ? final.contributed + Math.max(0, final.gains) : 0;
  const initialPercent = donutBase > 0 ? Number(initial) / donutBase * 100 : 0;
  const effectiveRate = Math.pow(1 + Number(rate) / 100 / Number(compounds), Number(compounds)) - 1;
  const setPhase = (id: string, patch: Partial<Phase>) => update(state => ({ phases: state.phases.map(phase => phase.id === id ? { ...phase, ...patch } : phase) }));
  const addPhase = () => {
    const firstGap = contributionGaps(phases.filter(validPhase), Math.min(50, Math.max(1, Number(years) || 10)))[0];
    const lastEnd = Math.max(0, ...phases.map(p => Number(p.endYear) || 0));
    const start = firstGap?.startYear ?? Math.min(50, lastEnd + 1);
    const end = firstGap ? Math.min(firstGap.endYear, start + 2) : Math.min(50, Math.max(start, Number(years) || start));
    update(state => ({ phases: [...state.phases, { id: crypto.randomUUID(), amount: '200', frequency: '12', startYear: String(start), endYear: String(end) }] }));
  };
  const delimiter = language === 'es' ? ';' : ',';
  const csvNumber = (value: number) => new Intl.NumberFormat(locale, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const csvHeader = [t('year'), ...(['csvAdded','csvInterest','contributed','csvGains','tableBalance'] as const).map(key => `${t(key)} (${currency})`)];
  const csvContent = '\uFEFF' + [csvHeader.join(delimiter), ...rows.map(row => [row.year, ...[row.addition, row.interest, row.contributed, row.gains, row.total].map(csvNumber)].join(delimiter))].join('\r\n');
  const csvHref = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  return <TooltipProvider delayDuration={250}><div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <div className="brand"><span className="brand-icon"><ChartNoAxesCombined size={21} strokeWidth={2.3} /></span>compound</div>
      <div className="preferences-controls">
        <Choice iconOnly icon={<Languages size={18} />} label={t('language')} value={language} onChange={value => update({ language: value as Preferences['language'] })} options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]} />
        <Choice iconOnly icon={theme === 'system' ? <Monitor size={18} /> : theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} label={t('theme')} value={theme} onChange={value => update({ theme: value as Preferences['theme'] })} options={(['system','light','dark'] as const).map(value => ({ value, label: t(value) }))} />
        <Choice iconOnly icon={currency==='EUR'?<Euro size={18} />:<DollarSign size={18} />} value={currency} onChange={value=>update({currency:value as Preferences['currency']})} label={t('currency')} options={[{value:'USD',label:'USD'},{value:'EUR',label:'EUR'}]} />
      </div>
      <Dialog><DialogTrigger asChild><Button variant="ghost" className="help-button" aria-label={t('how')}><CircleHelp size={17} /><span>{t('how')}</span></Button></DialogTrigger><DialogContent className="how-dialog" showCloseButton={false}><DialogClose asChild><Button variant="ghost" size="icon-sm" className="dialog-close" aria-label={t('close')}><X size={17} /></Button></DialogClose><DialogHeader><DialogTitle>{t('helpTitle')}</DialogTitle><DialogDescription>{t('helpIntro')}</DialogDescription></DialogHeader><div className="explanation">{(['1','2','3'] as const).map(n => <div key={n}><h3>{t(`help${n}`)}</h3><p>{t(`help${n}Text`)}</p></div>)}<h3>{t('assumptions')}</h3><p>{t('formula')}</p><p>{t('calendar')}</p><p>{t('caveats')}</p><p>{t('storageNote')}</p></div></DialogContent></Dialog>
    </div></header>
    <main className="main-container">
      <section className="page-heading"><div><h1>{t('heading')}</h1><p>{t('subtitle')}</p></div><SavedConfigurations /></section>
      <ConfigurationContext />
      {valid && final && <div className="mobile-summary" aria-live="polite"><span>{t('mobileBalance', { years: number(Number(years)) })}</span><strong>{metricMoney(final.total)}</strong><small>{t('mobileDetails', { contributed: metricMoney(final.contributed), gains: metricMoney(final.gains) })}</small></div>}
      <div className="workspace"><aside className="controls-column" aria-label={t('settings')}>
        <section className="panel settings-panel"><div className="section-heading"><h2><Wallet size={18} />{t('investment')}</h2>{!editingConfiguration && <Button variant="ghost" size="icon-sm" title={t('reset')} aria-label={t('reset')} onClick={resetPlan}><RotateCcw size={15} /></Button>}</div><div className="settings-fields">
          <NumberField id="initial" label={t('initial')} value={initial} onChange={initial => update({ initial })} prefix={symbol} />
          <div className="field">
            <div className="interest-labels"><Label htmlFor="rate">{t('rate')}</Label><Label htmlFor="compounding">{t('compounded')}</Label></div>
            <ButtonGroup className="interest-controls" aria-label={t('rate')}>
              <InputGroup className="interest-rate-input"><InputGroupInput id="rate" type="number" inputMode="decimal" min={-50} max={100} step="any" value={rate} onChange={event=>update({rate:event.target.value})} aria-invalid={!validRate} /><InputGroupAddon align="inline-end"><InputGroupText>%</InputGroupText></InputGroupAddon></InputGroup>
              <Choice id="compounding" className="compounding-choice" label={t('compounding')} value={compounds} onChange={compounds => update({ compounds })} options={([['365','daily'],['12','monthly'],['4','quarterly'],['2','halfYearly'],['1','yearly']] as const).map(([value,key]) => ({ value, label:t(key) }))} />
            </ButtonGroup>
          </div>
          <NumberField id="years" label={t('period')} value={years} onChange={years => update({ years })} suffix={t('years')} min={1} max={50} step="1" commitOnBlur />
          <fieldset className="years-slider"><legend className="sr-only">{t('periodYears')}</legend><Slider min={1} max={50} step={1} thumbLabels={[t('periodYears')]} thumbValueTexts={[duration(Number(years)||1)]} value={[Math.min(50, Math.max(1, Number(years) || 1))]} onPointerDownCapture={event=>{if(event.button===0)periodDrag.current={phases:null};}} onPointerUp={()=>{periodDrag.current=null;}} onPointerCancel={()=>{periodDrag.current=null;}} onLostPointerCapture={()=>{periodDrag.current=null;}} onValueChange={changePeriodFromSlider} /><div className="slider-labels"><span>{duration(1)}</span><span>{duration(50)}</span></div></fieldset>
        </div></section>
        <section className="panel contribution-panel"><div className="section-heading"><h2><Layers3 size={18} />{t('plan')}</h2><span className="small-badge">{t(phases.length === 1 ? 'phaseCount' : 'phasesCount', { count: number(phases.length) })}</span></div><p className="panel-intro">{t('planIntro')}</p>
          <div className="phases">{phases.map((phase,index)=><ContributionPhase key={phase.id} phase={phase} index={index} years={Number(years)||0} symbol={symbol} language={language} onChange={patch=>setPhase(phase.id,patch)} onRemove={()=>update(state=>({phases:state.phases.filter(p=>p.id!==phase.id)}))} />)}</div>
          {phases.length === 0 && <p className="empty-phases">{t('emptyPhases')}</p>}
          <Button variant="outline" className="add-phase" onClick={addPhase} disabled={phases.length >= 100}><Plus size={16} />{t('addPhase')}</Button>
          <p className="plan-note">{t('inclusive')}</p>
          {ranges.some(p => p.end > Number(years)) && <p className="limit-note">{t('clipped')}</p>}
          {overlap && <p className="plan-note"><Info size={13} />{t('overlap')}</p>}
          <div className="timing-field"><Label htmlFor="timing">{t('timing')}</Label><Choice id="timing" label={t('timingLabel')} value={timing} onChange={value => update({ timing: value as Preferences['timing'] })} options={[{ value: 'end', label: t('endTiming') }, { value: 'beginning', label: t('beginningTiming') }]} /></div>
        </section>
      </aside><section className="results-column" aria-label={t('projection')}>
        {!valid || !final ? <div className="panel validation" role="alert"><Info size={28} /><h2>{t('invalidTitle')}</h2><p>{t('invalidText')}</p></div> : <>
          <div className="metric-grid" aria-live="polite" aria-atomic="true"><section className="metric total-metric"><div className="metric-label">{t('balance')}</div><strong title={money(final.total, 2)}>{metricMoney(final.total)}</strong><span>{t('atEnd', { duration: duration(Number(years)) })}</span></section><section className="metric"><div className="metric-label"><span className="legend-square contributions-dot" />{t('contributed')}</div><strong title={money(final.contributed, 2)}>{metricMoney(final.contributed)}</strong><span>{t('working')}</span></section><section className="metric"><div className="metric-label"><span className="legend-square gains-dot" />{t(final.gains < 0 ? 'loss' : 'earned')}</div><strong className={final.gains < 0 ? 'loss-text' : 'gain-text'} title={money(final.gains, 2)}>{metricMoney(final.gains)}</strong><span>{final.contributed > 0 ? t('returnOn', { percent: percent(final.gains / final.contributed, 1, true) }) : t('growthOn')}</span></section></div>
          <section className="panel chart-panel"><Tabs value={view} onValueChange={view => update({ view: view as Preferences['view'] })}><div className="chart-header"><div><h2>{t('chartTitle')}</h2><p>{t('chartSubtitle')}</p></div><TabsList aria-label={t('chartView')}><TabsTrigger value="growth"><TrendingUp size={15} />{t('growth')}</TabsTrigger><TabsTrigger value="table">{t('yearlyView')}</TabsTrigger></TabsList></div><TabsContent value="growth"><div className="chart-legend">{([{ key: 'total', label: 'totalBalance', color: 'var(--chart-total)' }, { key: 'contributed', label: 'contributions', color: 'var(--chart-contributions)' }, { key: 'gains', label: 'interest', color: 'var(--chart-interest)' }] as const).map(series => <button key={series.key} type="button" aria-pressed={visible[series.key]} onClick={() => update(state => ({ visible: { ...state.visible, [series.key]: !state.visible[series.key] } }))} className={!visible[series.key] ? 'legend-inactive' : ''}><i style={{ background: series.color }} />{t(series.label)}</button>)}<span>{currency}</span></div>
            <div className="growth-chart" role="img" aria-label={t('chartDescription', { years: number(Number(years)), balance: money(final.total), contributed: money(final.contributed), gains: money(final.gains) })}><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 305 }}><AreaChart data={rows} margin={{ top: 20, right: 12, left: 0, bottom: 5 }}><defs><linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-total)" stopOpacity={0.19} /><stop offset="100%" stopColor="var(--chart-total)" stopOpacity={0.015} /></linearGradient><linearGradient id="contributionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-contributions)" stopOpacity={0.15} /><stop offset="100%" stopColor="var(--chart-contributions)" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="year" tickFormatter={value => t('yearShort', { year: number(Number(value)) })} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} minTickGap={30} dy={10} /><YAxis tickFormatter={compactMoney} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} width={76} tickCount={5} /><ChartTooltip itemStyle={{color: 'var(--popover-foreground)'}} formatter={(value, name) => [money(Number(value), 2), name]} labelFormatter={label => t('yearSingle', { year: number(Number(label)) })} contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 14, boxShadow: 'var(--shadow-md)' }} /><Area hide={!visible.total} type="monotone" dataKey="total" name={t('totalBalance')} stroke="var(--chart-total)" strokeWidth={2} fill="url(#totalFill)" isAnimationActive={false} /><Area hide={!visible.contributed} type="monotone" dataKey="contributed" name={t('contributions')} stroke="var(--chart-contributions)" strokeWidth={2} fill="url(#contributionFill)" isAnimationActive={false} /><Area hide={!visible.gains} type="monotone" dataKey="gains" name={t('interest')} stroke="var(--chart-interest)" strokeWidth={2} strokeDasharray="5 4" fill="transparent" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
          </TabsContent><TabsContent value="table"><div className="year-table"><Table><TableHeader><TableRow>{(['year','added','interest','tableContributed','tableBalance'] as const).map(key => <TableHead key={key}>{t(key)}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.year}><TableCell>{row.year === 0 ? t('start') : number(row.year)}</TableCell><TableCell>{money(row.addition, 2)}</TableCell><TableCell className={row.interest >= 0 ? 'gain-text' : 'loss-text'}>{money(row.interest, 2)}</TableCell><TableCell>{money(row.contributed, 2)}</TableCell><TableCell className="balance-cell">{money(row.total, 2)}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent></Tabs><div className="chart-bottom"><span>{t('live')}</span><Button variant="ghost" asChild><a href={csvHref} download={`${t('exportFile')}-${currency}.csv`}><Download size={15} />{t('export')}</a></Button></div></section>
          <section className="panel breakdown-panel"><div className="breakdown-main"><h2>{t(final.gains < 0 ? 'breakdownLoss' : 'breakdown')}</h2><div className="breakdown-content"><div className="donut" role="img" aria-label={t('interestShare', { percent: percent(growthShare) })} style={{ background: donutBase === 0 ? 'var(--muted)' : `conic-gradient(var(--chart-interest) 0 ${growthShare*100}%,var(--chart-contributions) ${growthShare*100}% ${100 - initialPercent}%,var(--chart-initial) ${100 - initialPercent}% 100%)` }}><div><strong>{percent(growthShare, 0)}</strong><small>{t('fromInterest')}</small></div></div><div className="breakdown-legend">{([{ key:'initial', amount:Number(initial), color:'var(--chart-initial)' }, { key:'additions', amount:final.contributed-Number(initial), color:'var(--chart-contributions)' }, { key:final.gains<0?'loss':'earned', amount:final.gains, color:final.gains<0?'var(--destructive)':'var(--chart-interest)' }] as const).map(item => <div key={item.key}><span><i style={{ background:item.color }} />{t(item.key)}</span><b className={item.key==='loss'?'loss-text':item.key==='earned'?'gain-text':''}>{metricMoney(item.amount)}</b></div>)}</div></div></div><div className="insight"><h3>{t(final.gains < 0 ? 'insightLoss' : 'insight')}</h3><p>{final.gains < 0 ? t('lossSentence', { amount: metricMoney(-final.gains) }) : final.gains === 0 ? t('zeroSentence') : t('gainSentence', { years: number(Number(years)), amount: metricMoney(final.gains) })}</p><span>{t('effectiveRate', { percent: percent(effectiveRate, 2) })}</span></div></section>
          <section className="panel timeline-panel"><div className="timeline-title"><h2>{t('journey')}</h2><span>{t('yearPlan', { years: number(Number(years)) })}</span></div>
            <div className="journey-axis"><span>{t('yearSingle',{year:1})}</span><span>{t('yearSingle',{year:Number(years)})}</span></div>
            <div className="journey-lanes">{ranges.map((p, index) => p.activeYears > 0 && <div className="journey-lane" key={p.id}><div className="journey-label"><i style={{ background: phaseColors[index % phaseColors.length] }} /><span><strong>{metricMoney(Number(p.amount))} <small>{t(perPeriod[p.frequency])}</small></strong><em>{rangeLabel(Number(p.startYear), Math.min(Number(p.endYear), Number(years)))}</em></span></div><div className="journey-track" role="img" aria-label={`${t('phaseName',{number:index+1})}: ${rangeLabel(Number(p.startYear),Math.min(Number(p.endYear),Number(years)))}`}><span style={{ left: `${p.start / Number(years) * 100}%`, width: `${p.activeYears / Number(years) * 100}%`, background: phaseColors[index % phaseColors.length] }} /></div></div>)}</div>
            {gaps.length > 0 && <div className="gap-summary"><strong>{t('noContributions')}</strong><span>{gaps.map(gap => rangeLabel(gap.startYear,gap.endYear)).join(' · ')}</span><p>{t('gapNote')}</p></div>}
          </section>
          <p className="projection-note"><Info size={15} /><span>{t('note')}</span></p>
        </>}
      </section></div><footer><span className="footer-brand">compound.</span><span>{t('footer')}</span><span className="footer-right">{t('footerRight')}</span></footer>
    </main>
  </div></TooltipProvider>;
}
