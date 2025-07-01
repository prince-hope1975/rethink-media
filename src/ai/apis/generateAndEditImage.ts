import {
  ControlReferenceImage,
  ControlReferenceType,
  GoogleGenAI,
} from "@google/genai";
import { InvalidArgumentError } from "ai";
import { z } from "zod";

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

const ai = new GoogleGenAI({
  vertexai: false,
  project: GOOGLE_CLOUD_PROJECT,
  location: GOOGLE_CLOUD_LOCATION,
});
const generateImage = async (prompt: string) => {
  // Validation
  z.string().parse(prompt);

  const generatedImagesResponse = await ai.models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt: prompt ?? "A square, circle, and triangle with a white background",
    config: {
      numberOfImages: 1,
      includeRaiReason: true,
      outputMimeType: "image/jpeg",
    },
  });
  if (!generatedImagesResponse?.generatedImages?.[0]?.image) {
    console.error("Image generation failed.");
    throw new z.ZodError([
      {
        message: "Image generation failed",
        path: [],
        code: "custom",
      },
    ]);
    return;
  }

  return generatedImagesResponse;
};

