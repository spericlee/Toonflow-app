import { sqliteTable, AnySQLiteColumn, integer, text } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const users = sqliteTable("users", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	username: text().notNull(),
	password: text().notNull(),
});

export const setting = sqliteTable("setting", {
	key: text().primaryKey().notNull(),
	value: text(),
});

