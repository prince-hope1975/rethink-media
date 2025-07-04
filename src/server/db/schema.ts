// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { index, pgEnum, pgTableCreator, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `rethink-media_${name}`);

export const chat = createTable(
  "chat",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)],
);

export const mediaStatus = pgEnum("media_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const mediaType = pgEnum("media_type", ["image", "video", "audio","text"]);

export const media = createTable(
  "media",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    chatId: d
      .integer()
      .notNull()
      .references(() => chat.id),
    type: mediaType("media_type").notNull(),
    index: d.integer().notNull(),
    content_or_url: d.varchar({ length: 512 }).notNull(), // Example field for media location
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
    status: mediaStatus("media_status").default("pending").notNull(),
    prompt: d.text("prompt"),
    parentId: d.integer(),
  }),
  (t) => [
    index("media_chat_type_index_idx").on(t.chatId, t.type, t.index),
    uniqueIndex("media_chat_type_index_unique").on(t.chatId, t.type, t.index),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "media_parent_id_fk"
    }),
  ],
);
