import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const accountPreferences = sqliteTable('account_preferences', {
  userId: text('user_id').primaryKey(),
  language: text('language').notNull().default('en'),
  theme: text('theme').notNull().default('system'),
  currency: text('currency').notNull().default('USD'),
  view: text('view').notNull().default('growth'),
  visible: text('visible').notNull().default('{"total":true,"contributed":true,"gains":true}'),
});

export const configurations = sqliteTable('configurations', {
  userId: text('user_id').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  configuration: text('configuration').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.id] }),
  uniqueIndex('configurations_user_name').on(table.userId, table.normalizedName),
]);
