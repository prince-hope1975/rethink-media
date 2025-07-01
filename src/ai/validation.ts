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
