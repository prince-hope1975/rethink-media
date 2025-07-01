import { z } from "zod";

export const tone = z.enum([
  "Playful",
  "Serious",
  "Bold",
  "Professional",
  "Casual",
  "Enthusiastic",
  "Minimalist",
  "Luxury",
  "Tech-savvy",
  "Friendly",
]);export const z_generateContentInterface = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  tone: tone,
  imageStyle: z.string().min(1, "Image style is required"),
  voiceStyle: z.string().min(1, "Voice style is required"),
  contentLengthInSeconds: z.number().optional().default(5),
});

export const z_contentResponse = z.object({
  result: z.object({
    headline: z.string(),
    caption: z.string(),
    audioPrompt: z.string(),
    imagePrompt: z.string(),
  }),
  chatId: z.number(),
});

