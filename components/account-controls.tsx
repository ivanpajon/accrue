"use client";
import { useState } from 'react';
import { ChartNoAxesCombined, CloudCheck, LoaderCircle, LogIn, LogOut, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { APP_NAME } from '@/lib/brand';
import { translator, type Language } from '@/lib/i18n';
import { usePreferences } from '@/lib/store';

export function SignIn({signInPath}:{signInPath:string}) {
  const [language,setLanguage]=useState<Language>('en');
  const t=translator(language);
  return <main className="sign-in-page"><section className="panel sign-in-card">
    <div className="brand"><span className="brand-icon"><ChartNoAxesCombined size={21} /></span>{APP_NAME}</div>
    <h1>{t('signInTitle')}</h1><p>{t('signInDescription')}</p>
    <Button asChild><a href={signInPath} target="_top"><LogIn />{t('signIn')}</a></Button>
    <div className="sign-in-language"><Button variant="ghost" size="sm" onClick={()=>setLanguage(language==='en'?'es':'en')}>{language==='en'?'Español':'English'}</Button></div>
  </section></main>;
}
export function AccountControls({displayName,signOutPath}:{displayName:string;signOutPath:string}) {
  const t=translator(usePreferences(state=>state.language));
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t('account')} title={t('account')}><UserRound size={18} /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end"><DropdownMenuLabel className="max-w-64 truncate">{displayName}</DropdownMenuLabel><DropdownMenuSeparator />
      <DropdownMenuItem asChild><a href={signOutPath} target="_top"><LogOut />{t('signOut')}</a></DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>;
}
export function AccountStatus({signInPath}:{signInPath:string}) {
  const state=usePreferences();const t=translator(state.language);
  const error=state.accountError ?? state.settingsError;
  const message=error==='unauthorized'?'sessionExpired':error==='conflict'?'configurationConflict':error==='missing'?'configurationUnavailable':error==='duplicate'?'configurationDuplicate':error==='limit'?'configurationLimit':'configurationStorageError';
  return <div className="account-status" role={error?'alert':'status'} aria-live="polite">
    {error?<><span>{t(message)}</span>{error==='unauthorized'?<Button asChild size="sm" variant="outline"><a href={signInPath} target="_top">{t('signIn')}</a></Button>:<Button size="sm" variant="outline" disabled={state.pending>0} onClick={()=>void state.retry()}>{t('retry')}</Button>}</>:
      <><span aria-hidden="true">{state.pending>0||!state.ready?<LoaderCircle size={14} className="animate-spin" />:<CloudCheck size={14} />}</span><span>{t(!state.ready?'accountLoading':state.pending>0?'accountSyncing':'accountConnected')}</span></>}
  </div>;
}
