import { z } from 'zod';
import { defaultPreferences, type Preferences } from './preferences.ts';
import { MAX_NAME_LENGTH, validConfiguration, type SavedConfiguration } from './configurations.ts';

export const settingsSchema = z.object({
  language: z.enum(['en', 'es']), theme: z.enum(['system', 'light', 'dark']),
  currency: z.enum(['USD', 'EUR']), view: z.enum(['growth', 'table']),
  visible: z.object({ total: z.boolean(), contributed: z.boolean(), gains: z.boolean() }).strict(),
}).strict();
export type AccountSettings = z.infer<typeof settingsSchema>;
export function accountSettings(p: Preferences): AccountSettings {
  return { language:p.language, theme:p.theme, currency:p.currency, view:p.view, visible:{...p.visible} };
}
export const defaultSettings = () => accountSettings(defaultPreferences());
const numberString = z.string().max(32);
export const configurationSchema = z.object({
  initial:numberString, rate:numberString, years:numberString,
  compounds:z.string().refine(value=>['1','2','4','12','365'].includes(value)), timing:z.enum(['beginning','end']),
  phases:z.array(z.object({
    id:z.string().min(1).max(100), amount:numberString, startYear:numberString, endYear:numberString,
    frequency:z.string().refine(value=>['1','2','4','12','26','52'].includes(value)),
  }).strict()).max(100),
}).strict().refine(value => validConfiguration(value) && new Set(value.phases.map(p=>p.id)).size===value.phases.length && value.phases.every(p=>Number(p.endYear)<=Number(value.years)), 'invalidConfiguration');
export const mutationSchema = z.discriminatedUnion('action', [
  z.object({action:z.literal('preferences'),patch:settingsSchema.partial()}).strict(),
  z.object({action:z.literal('save'),id:z.string().uuid(),name:z.string().trim().min(1).max(MAX_NAME_LENGTH),configuration:configurationSchema,revision:z.number().int().positive().optional()}).strict(),
  z.object({action:z.literal('delete'),id:z.string().uuid(),revision:z.number().int().positive()}).strict(),
]);
export type AccountMutation = z.infer<typeof mutationSchema>;
export type AccountData = { preferences:AccountSettings; savedConfigs:SavedConfiguration[]; saved?:SavedConfiguration };
export type AccountErrorCode = 'invalidName'|'invalidConfiguration'|'duplicate'|'limit'|'missing'|'conflict'|'unauthorized'|'storageError';
export class AccountError extends Error {
  code:AccountErrorCode;
  constructor(code:AccountErrorCode) { super(code); this.code=code; }
}
