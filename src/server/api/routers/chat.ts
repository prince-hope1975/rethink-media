import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { chat, media } from "~/server/db/schema";

export const chatRouter = createTRPCRouter({
  getChat: publicProcedure
    .input(
      z.object({
        chatID: z.number(),
      }),
    )
    .query(async ({ input }) => {
      // Get the chat
      const specific_chat = await db
        .select()
        .from(chat)
        .where(eq(chat.id, input.chatID));
      // Get all media for this chat
      const media_items = await db
        .select()
        .from(media)
        .where(
          and(eq(media.chatId, input.chatID), eq(media.status, "completed")),
        )
        .orderBy(desc(media.index));

      // Group media by type
      const groupedMedia = media_items.reduce(
        (acc, item) => {
          if (!acc[item.type]) acc[item.type] = [];
          acc?.[item?.type]?.push(item);
          return acc;
        },
        {} as Record<"video" | "audio" | "text" | "image", typeof media_items>,
      );

      return {
        chat: specific_chat[0] ?? null,
        media: groupedMedia,
      };
    }),
  getStatus: publicProcedure
    .input(
      z.object({
        chatID: z.number(),
        mediaID: z.number(),
        mediaType: z.enum(["audio", "image", "video"]),
      }),
    )
    .mutation(async ({ input }) => {
      const query = await db.query.media.findFirst({
        where: and(
          eq(media.chatId, input.chatID),
          eq(media.index, input.mediaID),
          eq(media.type, input.mediaType),
        ),
      });
      return query!;
    }),

  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(chat).values({
        name: input.name,
      });
    }),

  getLatest: publicProcedure.query(async ({ ctx }) => {
    const post = await ctx.db.query.chat.findFirst({
      orderBy: (chat, { desc }) => [desc(chat.createdAt)],
    });

    return post ?? null;
  }),

  getLatestMediaOrText: publicProcedure
    .input(
      z.object({
        chatID: z.number(),
        type: z.enum(["text", "video", "audio", "image"]),
      }),
    )
    .query(async ({ input }) => {
      const latest = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.chatId, input.chatID),
            eq(media.type, input.type),
            or(eq(media.status, "completed"), eq(media.status, "completed")),
          ),
        )
        .orderBy(desc(media.index))
        .limit(1);
      return latest[0] ?? null;
    }),
  getLatestAudios: publicProcedure
    .input(z.object({ chatID: z.number() }))
    .query(async ({ input }) => {
      const latest = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.chatId, input.chatID),
            eq(media.type, "audio"),
          ),
        )
        .orderBy(desc(media.index))
      return latest ;
    }),

  getLatestImages: publicProcedure
    .input(z.object({ chatID: z.number() }))
    .query(async ({ input }) => {
      const latest = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.chatId, input.chatID),
            eq(media.type, "image"),
            or(
              eq(media.status, "completed"),
              eq(media.status, "pending"),
              eq(media.status, "processing"),
            ),
          ),
        )
        .orderBy(desc(media.index))
        
      return latest ?? null;
    }),

  getLatestVideos: publicProcedure
    .input(z.object({ chatID: z.number() }))
    .query(async ({ input }) => {
      const latest = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.chatId, input.chatID),
            eq(media.type, "video"),
            or(
              eq(media.status, "completed"),
              eq(media.status, "pending"),
              eq(media.status, "processing"),
            ),
          ),
        )
        .orderBy(desc(media.index))
      return latest ?? null;
    }),

  getLatestTexts: publicProcedure
    .input(z.object({ chatID: z.number() }))
    .query(async ({ input }) => {
      const latest = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.chatId, input.chatID),
            eq(media.type, "text"),
            eq(media.status, "completed"),
          ),
        )
        .orderBy(desc(media.index))
      return latest ?? null;
    }),
});
