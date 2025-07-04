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
]);
export const z_generateContentInterface = z.object({
  chatID: z.number().optional(),
  prompt: z.string().min(1, "Prompt is required"),
  tone: tone,
  mediaStyle: z.string().min(1, "Image or video style is required"),
  voiceStyle: z.string().min(1, "Voice style is required"),
  mediaType: z.enum(["video", "image"]),
  contentLengthInSeconds: z.number().optional().default(5),
});

export const z_contentResponse = z.object({
  result: z.object({
    headline: z.string(),
    caption: z.string(),
    audioPrompt: z.string(),
    mediaPrompt: z.string(),
  }),
  chatId: z.number(),
  mediaIndex: z.number(),
  audioIndex: z.number(),
});
export const z_headline_and_caption = z.object({
  caption: z.string(),
  headline: z.string(),
});
