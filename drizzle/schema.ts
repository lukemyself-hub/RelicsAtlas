import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, double, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Heritage sites (全国重点文物保护单位)
 */
export const heritageSites = mysqlTable("heritage_sites", {
  id: int("id").autoincrement().primaryKey(),
  originalId: int("originalId").notNull(),
  categoryId: varchar("categoryId", { length: 32 }),
  name: varchar("name", { length: 255 }).notNull(),
  era: varchar("era", { length: 255 }),
  address: text("address"),
  type: varchar("type", { length: 128 }),
  batch: varchar("batch", { length: 32 }),
  longitude: double("longitude").notNull(),
  latitude: double("latitude").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_name").on(table.name),
  index("idx_batch").on(table.batch),
  index("idx_type").on(table.type),
  index("idx_coords").on(table.latitude, table.longitude),
]);

export type HeritageSite = typeof heritageSites.$inferSelect;
export type InsertHeritageSite = typeof heritageSites.$inferInsert;

/**
 * Cache for LLM-generated introductions
 */
export const siteIntroductions = mysqlTable("site_introductions", {
  id: int("id").autoincrement().primaryKey(),
  siteId: int("siteId").notNull().unique(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteIntroduction = typeof siteIntroductions.$inferSelect;
