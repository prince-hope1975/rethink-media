import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { chat } from "~/server/db/schema";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
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
