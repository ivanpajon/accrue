"use client";

import { useRef, useState } from 'react';
import { FileDown, ImageDown, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculateProjection } from '@/lib/compound';
import { validConfiguration } from '@/lib/configurations';
import { translator } from '@/lib/i18n';
import { usePreferences } from '@/lib/store';

export function ProjectionExports() {
  const state=usePreferences(),t=translator(state.language);
  const [busy,setBusy]=useState<'png'|'pdf'|null>(null),[error,setError]=useState(false),[notice,setNotice]=useState('');
  const inFlight=useRef(false);
  async function download(type:'png'|'pdf') {
    if(inFlight.current)return;
    const current=usePreferences.getState();
    if(!validConfiguration(current))return;
    // Capture the draft before any asynchronous work, so one file represents one plan.
    const snapshot={...current,phases:current.phases.map(p=>({...p})),visible:{...current.visible},name:current.savedConfigs.find(c=>c.id===current.activeConfigId)?.name ?? translator(current.language)('untitledConfiguration'),createdAt:new Date(),rows:calculateProjection(Number(current.initial),Number(current.rate),Number(current.compounds),Number(current.years),current.phases,current.timing)};
    inFlight.current=true;setBusy(type);setError(false);setNotice('');
    try {const {exportProjection}=await import('@/lib/export-projection');await exportProjection(snapshot,type);setNotice(translator(current.language)('exportReady'));}
    catch {setError(true);}
    finally {inFlight.current=false;setBusy(null);}
  }
  return <div className="projection-exports" aria-busy={!!busy}>
    <div className="export-buttons">
      <Button variant="ghost" disabled={!!busy||!Object.values(state.visible).some(Boolean)} title={!Object.values(state.visible).some(Boolean)?t('exportChooseSeries'):t('exportImageHint')} onClick={()=>download('png')}>{busy==='png'?<LoaderCircle className="animate-spin" size={15}/>:<ImageDown size={15}/>} {t(busy==='png'?'exportPreparing':'saveImage')}</Button>
      <Button variant="ghost" disabled={!!busy} title={t('exportPdfHint')} onClick={()=>download('pdf')}>{busy==='pdf'?<LoaderCircle className="animate-spin" size={15}/>:<FileDown size={15}/>} {t(busy==='pdf'?'exportPreparing':'exportPdf')}</Button>
    </div>
    {error&&<p className="export-error" role="alert">{t('exportError')}</p>}
    <span className="sr-only" role="status" aria-live="polite">{busy?t('exportPreparing'):notice}</span>
  </div>;
}
