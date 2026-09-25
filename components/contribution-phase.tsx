"use client";

import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { validPhase, type Phase } from '@/lib/compound';
import { locales, translator, type Language, type MessageKey } from '@/lib/i18n';
import { investmentHorizon, normalizeYearRange, type YearEndpoint, type YearRange } from '@/lib/phase-range';

const recurrenceKeys = [['12','monthly'],['52','weekly'],['26','fortnightly'],['4','quarterly'],['2','halfYearly'],['1','yearly']] as const;
const perPeriod: Record<string,MessageKey> = {'12':'perMonth','52':'perWeek','26':'perFortnight','4':'perQuarter','2':'perHalfYear','1':'perYear'};

export function ContributionPhase({phase,index,years,symbol,language,onChange,onRemove}: {
  phase:Phase; index:number; years:number; symbol:string; language:Language;
  onChange:(patch:Partial<Phase>) => void; onRemove:() => void;
}) {
  const t = translator(language);
  const n = (value:number) => new Intl.NumberFormat(locales[language]).format(value);
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState<YearRange>({startYear:phase.startYear,endYear:phase.endYear});
  const editedEndpoint = useRef<YearEndpoint>('startYear');
  const horizon = investmentHorizon(years);
  const editYear = (endpoint:YearEndpoint,value:string) => {
    editedEndpoint.current = endpoint;
    setDraft(previous=>({...previous,[endpoint]:value}));
  };
  const finishYear = (endpoint:YearEndpoint) => setDraft(previous=>normalizeYearRange(previous,horizon,endpoint,phase));
  const dateValid = (start:string,end:string) => Number.isInteger(Number(start)) && Number(start) >= 1 && Number(start) <= 50 && Number.isInteger(Number(end)) && Number(end) >= Number(start) && Number(end) <= 50;
  const datesValid = dateValid(phase.startYear,phase.endYear);
  const amountValid = phase.amount.trim() !== '' && Number.isFinite(Number(phase.amount)) && Number(phase.amount) >= 0 && Number(phase.amount) <= 1e9;
  const start = Math.min(50,Math.max(1,Math.round(Number(phase.startYear)||1)));
  const end = Math.max(start,Math.min(50,Math.max(1,Math.round(Number(phase.endYear)||start))));
  // Extend the scale as needed, but never shrink it underneath a moving thumb.
  const requiredMax = Math.max(2,end,Math.min(50,Math.round(years)||1));
  const [scaleMax,setScaleMax] = useState(requiredMax);
  const max = Math.max(scaleMax,requiredMax);
  useEffect(()=>setScaleMax(previous=>Math.max(previous,requiredMax)),[requiredMax]);
  const range = datesValid ? start === end ? t('yearSingle',{year:n(start)}) : t('yearRange',{start:n(start),end:n(end)}) : t('chooseYears');
  const count = end-start+1;

  return <article className="contribution-phase" aria-label={t('phaseName',{number:index+1})}>
    <div className="contribution-phase-heading"><span className="phase-marker" aria-hidden="true">{n(index+1)}</span><strong>{t('phaseName',{number:index+1})}</strong><Button variant="ghost" size="icon-sm" className="phase-remove" aria-label={t('removePhase',{number:index+1})} onClick={onRemove}><X size={15} /></Button></div>
    <div className={`contribution-amount-group ${amountValid?'':'invalid'}`}>
      <div className="contribution-amount"><Label className="sr-only" htmlFor={`amount-${phase.id}`}>{t('phaseAmount',{number:index+1})}</Label><span aria-hidden="true">{symbol}</span><Input id={`amount-${phase.id}`} type="number" inputMode="decimal" min={0} max={1e9} step="any" value={phase.amount} onChange={event=>onChange({amount:event.target.value})} aria-invalid={!amountValid} /></div>
      <Select value={phase.frequency} onValueChange={frequency=>onChange({frequency})}><SelectTrigger className="contribution-recurrence" aria-label={t('phaseRecurrence',{number:index+1})}><SelectValue>{t(perPeriod[phase.frequency])}</SelectValue></SelectTrigger><SelectContent position="popper" align="end">{recurrenceKeys.map(([value,key])=><SelectItem key={value} value={value}>{t(key)}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="phase-range-heading">
      <Popover open={open} onOpenChange={next=>{setOpen(next);if(next){setDraft(normalizeYearRange(phase,horizon));editedEndpoint.current='startYear';}}}>
        <PopoverTrigger asChild><Button variant="ghost" className="phase-range-button" aria-label={t('editPhaseRange',{number:index+1,range})}><CalendarRange size={14} /><span>{range}</span><ChevronDown size={12} /></Button></PopoverTrigger>
        <PopoverContent className="phase-range-popover" align="start" aria-label={t('phaseRange',{number:index+1})}>
          <form noValidate onSubmit={event=>{event.preventDefault();onChange(normalizeYearRange(draft,horizon,editedEndpoint.current,phase));setOpen(false);}}>
            <h3>{t('phaseRange',{number:index+1})}</h3><p id={`range-hint-${phase.id}`}>{t('phaseRangeHint',{max:n(horizon)})}</p>
            <div className="exact-phase-years"><div><Label htmlFor={`start-${phase.id}`}>{t('startYear')}</Label><Input id={`start-${phase.id}`} aria-label={t('phaseStart',{number:index+1})} aria-describedby={`range-hint-${phase.id}`} type="number" inputMode="numeric" min={1} max={horizon} step={1} value={draft.startYear} onChange={event=>editYear('startYear',event.target.value)} onBlur={()=>finishYear('startYear')} /></div><div><Label htmlFor={`end-${phase.id}`}>{t('endYear')}</Label><Input id={`end-${phase.id}`} aria-label={t('phaseEnd',{number:index+1})} aria-describedby={`range-hint-${phase.id}`} type="number" inputMode="numeric" min={1} max={horizon} step={1} value={draft.endYear} onChange={event=>editYear('endYear',event.target.value)} onBlur={()=>finishYear('endYear')} /></div></div>
            <p className="phase-range-help">{t('phaseRangeAutoAdjust')}</p>
            <div className="phase-range-actions"><Button type="button" variant="ghost" size="sm" onClick={()=>setOpen(false)}>{t('cancel')}</Button><Button type="submit" size="sm">{t('applyRange')}</Button></div>
          </form>
        </PopoverContent>
      </Popover>
      {datesValid && <span className="phase-length">{t(count===1?'yearCount':'yearsCount',{count:n(count)})}</span>}
    </div>
    <fieldset className="phase-range-slider"><legend className="sr-only">{t('phaseRange',{number:index+1})}</legend><Slider min={1} max={max} step={1} minStepsBetweenThumbs={0} value={[start,end]} onValueChange={values=>onChange({startYear:String(values[0]),endYear:String(values[1])})} thumbLabels={[t('phaseStart',{number:index+1}),t('phaseEnd',{number:index+1})]} thumbValueTexts={[t('yearSingle',{year:n(start)}),t('yearSingle',{year:n(end)})]} /><div className="phase-range-axis" aria-hidden="true"><span>{t('yearSingle',{year:1})}</span><span>{t('yearSingle',{year:n(max)})}</span></div></fieldset>
    {!validPhase(phase) ? <p className="phase-error">{t(amountValid?'phaseError':'phaseAmountError')}</p> : start > years ? <p className="phase-status">{t('outside')}</p> : null}
  </article>;
}
