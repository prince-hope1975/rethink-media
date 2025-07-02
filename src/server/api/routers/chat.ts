import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { chat, media } from "~/server/db/schema";

export const chatRouter = createTRPCRouter({
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
});
