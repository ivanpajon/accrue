"use client";

import { useState } from 'react';
import { Check, FolderOpen, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MAX_NAME_LENGTH, sameConfiguration, validConfiguration } from '@/lib/configurations';
import { defaultPreferences } from '@/lib/preferences';
import { locales, translator, type MessageKey } from '@/lib/i18n';
import { usePreferences } from '@/lib/store';

export function SavedConfigurations() {
  const state = usePreferences();
  const t = translator(state.language);
  const [saveOpen,setSaveOpen] = useState(false);
  const [loadOpen,setLoadOpen] = useState(false);
  const [name,setName] = useState('');
  const [error,setError] = useState<MessageKey | null>(null);
  const [deleteId,setDeleteId] = useState<string | null>(null);
  const [notice,setNotice] = useState('');
  const active = state.savedConfigs.find(item => item.id === state.activeConfigId);
  const unchanged = !!active && sameConfiguration(state,active.configuration);
  const dirty = !sameConfiguration(state,active?.configuration ?? defaultPreferences());
  const duplicate = state.savedConfigs.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
  const valid = validConfiguration(state);
  const closeButton = <DialogClose asChild><Button variant="ghost" size="icon-sm" className="dialog-close" aria-label={t('close')}><X size={17} /></Button></DialogClose>;

  function save() {
    const result = state.saveConfiguration(name,duplicate?.id);
    if (result !== 'saved') {
      const errors = {invalidName:'configurationNameError',invalidConfiguration:'saveInvalid',duplicate:'configurationDuplicate',limit:'configurationLimit',storageError:'configurationStorageError'} as const;
      setError(errors[result]);
      return;
    }
    setSaveOpen(false);
    setNotice(t('configurationSaved',{name:name.trim()}));
  }

  return <div className="configuration-controls">
    <Dialog open={saveOpen} onOpenChange={open => {setSaveOpen(open);setError(null);if(open) setName(active?.name ?? '');}}>
      <DialogTrigger asChild><Button variant="outline" className="save-configuration" disabled={!valid} title={!valid ? t('saveInvalid') : active?.name}>
        {unchanged ? <Check size={16} /> : <Save size={16} />}{t(unchanged ? 'saved' : 'save')}
      </Button></DialogTrigger>
      <DialogContent className="configuration-dialog" showCloseButton={false}>
        {closeButton}
        <DialogHeader><DialogTitle>{t('saveConfiguration')}</DialogTitle><DialogDescription>{t('saveConfigurationDescription')}</DialogDescription></DialogHeader>
        <form onSubmit={event => {event.preventDefault();save();}} className="configuration-form">
          <div className="field"><Label htmlFor="configuration-name">{t('configurationName')}</Label><Input id="configuration-name" value={name} onChange={event => {setName(event.target.value);setError(null);}} placeholder={t('configurationNamePlaceholder')} maxLength={MAX_NAME_LENGTH} autoComplete="off" autoFocus aria-invalid={error === 'configurationNameError'} aria-describedby={error ? 'configuration-save-error' : duplicate ? 'configuration-replace-note' : undefined} /></div>
          {duplicate && <p className="configuration-note" id="configuration-replace-note">{t('configurationReplaceNote',{name:duplicate.name})}</p>}
          {error && <p className="configuration-error" id="configuration-save-error" role="alert">{t(error)}</p>}
          <DialogFooter><DialogClose asChild><Button variant="outline" type="button">{t('cancel')}</Button></DialogClose><Button type="submit" disabled={!name.trim() || !valid}><Save size={16} />{t(duplicate ? 'replaceConfiguration' : 'save')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {state.savedConfigs.length > 0 && <Dialog open={loadOpen} onOpenChange={open => {setLoadOpen(open);setDeleteId(null);setError(null);}}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="saved-configurations-button" aria-label={t('savedConfigurations')} title={t('savedConfigurations')}><FolderOpen size={19} /><span className="configuration-count" aria-hidden="true">{state.savedConfigs.length}</span></Button></DialogTrigger>
      <DialogContent className="configuration-dialog" showCloseButton={false}>
        {closeButton}
        <DialogHeader><DialogTitle>{t('savedConfigurations')}</DialogTitle><DialogDescription>{t('loadConfigurationDescription')}</DialogDescription></DialogHeader>
        {dirty && <p className="configuration-note">{t('loadDraftWarning')}</p>}
        {error && <p className="configuration-error" role="alert">{t(error)}</p>}
        <ul className="saved-configuration-list">{state.savedConfigs.map(item => <li key={item.id}>
          <div className="saved-configuration-heading"><strong>{item.name}</strong>{active?.id === item.id && unchanged && <span>{t('currentConfiguration')}</span>}</div>
          <p>{t(Number(item.configuration.years) === 1 ? 'yearCount' : 'yearsCount',{count:item.configuration.years})} · {t(item.configuration.phases.length === 1 ? 'phaseCount' : 'phasesCount',{count:item.configuration.phases.length})}</p>
          <small>{t('configurationUpdated',{date:new Intl.DateTimeFormat(locales[state.language],{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.updatedAt))})}</small>
          {deleteId === item.id ? <div className="configuration-delete"><p>{t('deleteConfigurationQuestion',{name:item.name})}</p><div><Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>{t('cancel')}</Button><Button variant="destructive" size="sm" onClick={() => {
            if (!state.deleteConfiguration(item.id)) {setError('configurationStorageError');return;}
            setDeleteId(null);setNotice(t('configurationDeleted',{name:item.name}));
            if (state.savedConfigs.length === 1) setLoadOpen(false);
          }}>{t('deleteConfiguration')}</Button></div></div> : <div className="saved-configuration-actions">
            <Button variant="outline" size="sm" aria-label={t('loadNamedConfiguration',{name:item.name})} onClick={() => {if(state.loadConfiguration(item.id)){setLoadOpen(false);setNotice(t('configurationLoaded',{name:item.name}));}}}><FolderOpen size={15} />{t('loadConfiguration')}</Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('deleteNamedConfiguration',{name:item.name})} title={t('deleteNamedConfiguration',{name:item.name})} onClick={() => {setDeleteId(item.id);setError(null);}}><Trash2 size={16} /></Button>
          </div>}
        </li>)}</ul>
      </DialogContent>
    </Dialog>}
    <span className="sr-only" role="status" aria-live="polite">{notice}</span>
  </div>;
}
