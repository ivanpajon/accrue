"use client";

import { useRef, useState } from 'react';
import { Check, ChevronDown, Copy, FilePenLine, FilePlus2, FolderOpen, Pencil, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MAX_NAME_LENGTH, sameConfiguration, validConfiguration } from '@/lib/configurations';
import { defaultPreferences } from '@/lib/preferences';
import { locales, translator, type MessageKey } from '@/lib/i18n';
import { usePreferences, type SaveResult } from '@/lib/store';

const saveErrors: Record<Exclude<SaveResult,'saved'>,MessageKey> = {
  invalidName:'configurationNameError', invalidConfiguration:'saveInvalid', duplicate:'configurationDuplicate',
  limit:'configurationLimit', storageError:'configurationStorageError', missing:'configurationUnavailable',
};

export function ConfigurationContext() {
  const state = usePreferences();
  const t = translator(state.language);
  const active = state.savedConfigs.find(item=>item.id===state.activeConfigId);
  const modified = !!active && !sameConfiguration(state,active.configuration);
  return <section className="configuration-context" aria-label={t('configurationContext')}>
    {active ? <FilePenLine size={20} aria-hidden="true" /> : <FilePlus2 size={20} aria-hidden="true" />}
    <div className="configuration-identity"><span>{t(active?'editingConfiguration':'newConfiguration')}</span><strong>{active?.name ?? t('untitledConfiguration')}</strong></div>
    <span role="status" aria-live="polite"><Badge variant={modified?'secondary':'outline'}>{active && (modified?<Pencil />:<Check />)}{t(active ? modified?'unsavedChanges':'saved' : 'notSaved')}</Badge></span>
  </section>;
}

export function SavedConfigurations() {
  const controlsRef = useRef<HTMLDivElement>(null);
  const state = usePreferences();
  const t = translator(state.language);
  const [saveOpen,setSaveOpen] = useState(false);
  const [copyMode,setCopyMode] = useState(false);
  const [loadOpen,setLoadOpen] = useState(false);
  const [name,setName] = useState('');
  const [error,setError] = useState<MessageKey | null>(null);
  const [actionError,setActionError] = useState<MessageKey | null>(null);
  const [deleteId,setDeleteId] = useState<string | null>(null);
  const [pendingAction,setPendingAction] = useState<'new'|'revert'|null>(null);
  const [notice,setNotice] = useState('');
  const active = state.savedConfigs.find(item => item.id === state.activeConfigId);
  const unchanged = !!active && sameConfiguration(state,active.configuration);
  const dirty = !sameConfiguration(state,active?.configuration ?? defaultPreferences());
  const duplicate = state.savedConfigs.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
  const valid = validConfiguration(state);
  const closeButton = <DialogClose asChild><Button variant="ghost" size="icon-sm" className="dialog-close" aria-label={t('close')}><X size={17} /></Button></DialogClose>;
  function restoreFocus(event:Event) {
    event.preventDefault();
    const controls = controlsRef.current;
    (controls?.querySelector<HTMLButtonElement>('.configuration-menu-button') ?? controls?.querySelector<HTMLButtonElement>('.save-configuration:not(:disabled)'))?.focus();
  }

  function openSave(asCopy = false) {
    setCopyMode(asCopy);setName('');setError(null);setActionError(null);setSaveOpen(true);
  }
  function save() {
    const result = state.saveConfiguration(name,copyMode?undefined:duplicate?.id);
    if (result !== 'saved') {setError(result==='duplicate'&&copyMode?'configurationCopyDuplicate':saveErrors[result]);return;}
    setSaveOpen(false);setNotice(t('configurationSaved',{name:name.trim()}));
  }
  function saveChanges() {
    setActionError(null);
    const result = state.updateActiveConfiguration();
    if (result !== 'saved') {setActionError(saveErrors[result]);return;}
    setNotice(t('configurationSaved',{name:active?.name ?? ''}));
  }
  function runAction(action:'new'|'revert') {
    setActionError(null);
    if (action==='new') {state.resetPlan();setNotice(t('newConfiguration'));}
    else if (active && state.loadConfiguration(active.id)) setNotice(t('configurationReverted',{name:active.name}));
    else setActionError('configurationUnavailable');
  }
  function requestAction(action:'new'|'revert') {
    if (dirty) setPendingAction(action);
    else runAction(action);
  }

  return <div className="configuration-controls" ref={controlsRef}>
    {active ? <ButtonGroup className="configuration-save-group">
      <Button variant="outline" className="save-configuration" disabled={!valid || unchanged} title={!valid?t('saveInvalid'):active.name} onClick={saveChanges}><Save size={16} />{t('saveChanges')}</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="configuration-menu-button" aria-label={t('configurationActions')}><ChevronDown size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!valid} onSelect={()=>openSave(true)}><Copy />{t('saveAsCopy')}</DropdownMenuItem>
        <DropdownMenuItem disabled={unchanged} onSelect={()=>requestAction('revert')}><RotateCcw />{t('revertConfiguration')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={()=>requestAction('new')}><FilePlus2 />{t('newConfiguration')}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </ButtonGroup> : <Button variant="outline" className="save-configuration" disabled={!valid} title={!valid?t('saveInvalid'):undefined} onClick={()=>openSave()}><Save size={16} />{t('save')}</Button>}
    <Dialog open={saveOpen} onOpenChange={open=>{setSaveOpen(open);if(!open)setError(null);}}>
      <DialogContent className="configuration-dialog" showCloseButton={false} onCloseAutoFocus={restoreFocus}>
        {closeButton}
        <DialogHeader><DialogTitle>{t(copyMode?'saveAsCopy':'saveConfiguration')}</DialogTitle><DialogDescription>{t(copyMode?'saveCopyDescription':'saveConfigurationDescription')}</DialogDescription></DialogHeader>
        <form onSubmit={event=>{event.preventDefault();save();}} className="configuration-form">
          <div className="field"><Label htmlFor="configuration-name">{t('configurationName')}</Label><Input id="configuration-name" value={name} onChange={event=>{setName(event.target.value);setError(null);}} placeholder={t('configurationNamePlaceholder')} maxLength={MAX_NAME_LENGTH} autoComplete="off" autoFocus aria-invalid={error==='configurationNameError'||!!(copyMode&&duplicate)} aria-describedby={error?'configuration-save-error':duplicate?'configuration-replace-note':undefined} /></div>
          {duplicate && <p className="configuration-note" id="configuration-replace-note">{t(copyMode?'configurationCopyDuplicate':'configurationReplaceNote',{name:duplicate.name})}</p>}
          {error && <p className="configuration-error" id="configuration-save-error" role="alert">{t(error)}</p>}
          <DialogFooter><DialogClose asChild><Button variant="outline" type="button">{t('cancel')}</Button></DialogClose><Button type="submit" disabled={!name.trim()||!valid||!!(copyMode&&duplicate)}><Save size={16} />{t(duplicate&&!copyMode?'replaceConfiguration':'save')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {state.savedConfigs.length>0 && <Dialog open={loadOpen} onOpenChange={open=>{setLoadOpen(open);setDeleteId(null);setError(null);setActionError(null);}}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="saved-configurations-button" aria-label={t('savedConfigurations')} title={t('savedConfigurations')}><FolderOpen size={19} /><span className="configuration-count" aria-hidden="true">{state.savedConfigs.length}</span></Button></DialogTrigger>
      <DialogContent className="configuration-dialog" showCloseButton={false}>
        {closeButton}
        <DialogHeader><DialogTitle>{t('savedConfigurations')}</DialogTitle><DialogDescription>{t('loadConfigurationDescription')}</DialogDescription></DialogHeader>
        {dirty && <p className="configuration-note">{t('loadDraftWarning')}</p>}
        {error && <p className="configuration-error" role="alert">{t(error)}</p>}
        <ul className="saved-configuration-list">{state.savedConfigs.map(item=><li key={item.id}>
          <div className="saved-configuration-heading"><strong>{item.name}</strong>{active?.id===item.id && <Badge variant="secondary">{t('editing')}</Badge>}</div>
          <p>{t(Number(item.configuration.years)===1?'yearCount':'yearsCount',{count:item.configuration.years})} · {t(item.configuration.phases.length===1?'phaseCount':'phasesCount',{count:item.configuration.phases.length})}</p>
          <small>{t('configurationUpdated',{date:new Intl.DateTimeFormat(locales[state.language],{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.updatedAt))})}</small>
          {deleteId===item.id ? <div className="configuration-delete"><p>{t('deleteConfigurationQuestion',{name:item.name})}</p><div><Button variant="outline" size="sm" onClick={()=>setDeleteId(null)}>{t('cancel')}</Button><Button variant="destructive" size="sm" onClick={()=>{
            if(!state.deleteConfiguration(item.id)){setError('configurationStorageError');return;}
            setDeleteId(null);setNotice(t('configurationDeleted',{name:item.name}));
            if(state.savedConfigs.length===1)setLoadOpen(false);
          }}>{t('deleteConfiguration')}</Button></div></div> : <div className="saved-configuration-actions">
            <Button variant="outline" size="sm" disabled={active?.id===item.id&&unchanged} aria-label={t('loadNamedConfiguration',{name:item.name})} onClick={()=>{if(state.loadConfiguration(item.id)){setLoadOpen(false);setNotice(t('configurationLoaded',{name:item.name}));}else setError('configurationUnavailable');}}><FolderOpen size={15} />{t('loadConfiguration')}</Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('deleteNamedConfiguration',{name:item.name})} title={t('deleteNamedConfiguration',{name:item.name})} onClick={()=>{setDeleteId(item.id);setError(null);}}><Trash2 size={16} /></Button>
          </div>}
        </li>)}</ul>
      </DialogContent>
    </Dialog>}
    <AlertDialog open={pendingAction!==null} onOpenChange={open=>{if(!open)setPendingAction(null);}}>
      <AlertDialogContent onCloseAutoFocus={restoreFocus}><AlertDialogHeader><AlertDialogTitle>{t(pendingAction==='revert'?'revertConfiguration':'startNewConfiguration')}</AlertDialogTitle><AlertDialogDescription>{t(pendingAction==='revert'?'revertConfigurationDescription':'newConfigurationDescription',{name:active?.name??''})}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={()=>{if(pendingAction)runAction(pendingAction);setPendingAction(null);}}>{t(pendingAction==='revert'?'discardChanges':'discardAndStartNew')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    {actionError && <p className="configuration-action-error" role="alert">{t(actionError)}</p>}
    <span className="sr-only" role="status" aria-live="polite">{notice}</span>
  </div>;
}

