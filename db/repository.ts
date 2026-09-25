import { AccountError, defaultSettings, type AccountData, type AccountMutation, type AccountSettings } from '../lib/account.ts';
import { MAX_CONFIGURATIONS, sameConfiguration, type SavedConfiguration } from '../lib/configurations.ts';

type ConfigRow = {id:string;name:string;configuration:string;revision:number;updated_at:string};
const config = (row:ConfigRow):SavedConfiguration => ({id:row.id,name:row.name,configuration:JSON.parse(row.configuration),revision:row.revision,updatedAt:row.updated_at});

export async function readAccount(db:D1Database, userId:string):Promise<AccountData> {
  const [prefs, plans] = await db.batch([
    db.prepare('SELECT language, theme, currency, view, visible FROM account_preferences WHERE user_id = ?').bind(userId),
    db.prepare('SELECT id, name, configuration, revision, updated_at FROM configurations WHERE user_id = ? ORDER BY updated_at DESC, id').bind(userId),
  ]);
  const p=prefs.results[0] as (Omit<AccountSettings,'visible'>&{visible:string})|undefined;
  return {preferences:p?{...p,visible:JSON.parse(p.visible)}:defaultSettings(),savedConfigs:(plans.results as ConfigRow[]).map(config)};
}

export async function mutateAccount(db:D1Database, userId:string, change:AccountMutation):Promise<SavedConfiguration|undefined> {
  if(change.action==='preferences') {
    const entries=Object.entries(change.patch);
    if(!entries.length) return;
    // These names come from the strict API schema, never unchecked input.
    const columns=entries.map(([key])=>key);
    await db.prepare(`INSERT INTO account_preferences (user_id, ${columns.join(', ')}) VALUES (?, ${columns.map(()=>'?').join(', ')}) ON CONFLICT(user_id) DO UPDATE SET ${columns.map(key=>`${key} = excluded.${key}`).join(', ')}`)
      .bind(userId,...entries.map(([key,value])=>key==='visible'?JSON.stringify(value):value)).run();
    return;
  }
  const row=await db.prepare('SELECT id, name, configuration, revision, updated_at FROM configurations WHERE user_id = ? AND id = ?').bind(userId,change.id).first<ConfigRow>();
  if(change.action==='delete') {
    if(!row) return;
    const result=await db.prepare('DELETE FROM configurations WHERE user_id = ? AND id = ? AND revision = ?').bind(userId,change.id,change.revision).run();
    if(!result.meta.changes) throw new AccountError('conflict');
    return;
  }
  if(change.revision!==undefined && !row) throw new AccountError('missing');
  // Retrying an identical request after a lost response does not create a second plan.
  if(row && row.name===change.name && sameConfiguration(JSON.parse(row.configuration),change.configuration)) return config(row);
  if(row && row.revision!==change.revision) throw new AccountError('conflict');
  try {
    const now=new Date().toISOString();
    const result=row
      ? await db.prepare('UPDATE configurations SET name = ?, normalized_name = ?, configuration = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND id = ? AND revision = ? RETURNING id, name, configuration, revision, updated_at')
        .bind(change.name,change.name.toLowerCase(),JSON.stringify(change.configuration),now,userId,change.id,change.revision!).first<ConfigRow>()
      : await db.prepare('INSERT INTO configurations (user_id, id, name, normalized_name, configuration, revision, updated_at) SELECT ?, ?, ?, ?, ?, 1, ? WHERE (SELECT COUNT(*) FROM configurations WHERE user_id = ?) < ? RETURNING id, name, configuration, revision, updated_at')
        .bind(userId,change.id,change.name,change.name.toLowerCase(),JSON.stringify(change.configuration),now,userId,MAX_CONFIGURATIONS).first<ConfigRow>();
    if(!result) throw new AccountError(row?'conflict':'limit');
    return config(result);
  } catch(error) {
    if(error instanceof AccountError) throw error;
    if(String(error).includes('UNIQUE constraint failed')) throw new AccountError('duplicate');
    throw error;
  }
}
