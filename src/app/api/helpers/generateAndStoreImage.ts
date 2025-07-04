import { after, NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import mime from "mime";

import { z_contentResponse, z_generateContentInterface } from "~/ai/validation";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  convertToWav,
  generateAudioTTS,
} from "~/ai/apis/generateAudioTextToSpeech";
import { chat, media } from "~/server/db/schema";
import { db } from "~/server/db";
import { and, desc, eq } from "drizzle-orm";
import { storeHeadlineAndCaption } from "../helpers/storeHeadlineAndCaption";

interface GenerateAndStoreImageParams {
  content: { imagePrompt: string };
  dataBaseID: number;
  lastImageIndex: any;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const generateAndStoreImage = async ({
  content,
  dataBaseID,
  lastImageIndex,
}: GenerateAndStoreImageParams) => {
  try {
    const ai = new GoogleGenAI({ vertexai: false, apiKey: GEMINI_API_KEY });

    console.log("Generating image with prompt:", content.imagePrompt);
    if (!content.imagePrompt) {
      throw new Error("Image prompt is missing in the generated content");
    }
    await db.insert(media).values({
      chatId: dataBaseID,
      index: (lastImageIndex.at(0)?.index ?? 0) + 1,
      type: "image",
      status: "pending",
      content_or_url: "",
      prompt: content.imagePrompt,
    });

    const imgContent = await ai.models.generateImages({
      // model: " imagen-4.0-generate-preview-06-06",
      model: "models/imagen-4.0-generate-preview-06-06",
      prompt: content.imagePrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: "1:1",
      },
    });
    console.log("Image generation response:", imgContent);

    const imageBytes = imgContent?.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      throw new Error("Image generation failed");
    }

    const buffer =
      typeof imageBytes === "string"
        ? Buffer.from(imageBytes, "base64")
        : imageBytes;

    console.log("Uploading image to Vercel Blob...");
    const blob = await put(
      `chat-${dataBaseID}-image-${Date.now()}.jpg`,
      buffer,
      {
        access: "public",
        contentType: "image/jpeg",
      },
    );
    console.log("Image uploaded to:", blob.url);

    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastImageIndex.at(0)?.index ?? 0) + 1,
        type: "image",
        content_or_url: blob.url,
        status: "completed",
        prompt: content.imagePrompt,
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "completed", content_or_url: blob.url },
      });
    console.log("Image media record inserted");
  } catch (err) {
    console.error("Error in generateAndStoreImage:", err);
    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastImageIndex.at(0)?.index ?? 0) + 1,
        type: "image",
        prompt: content.imagePrompt,
        content_or_url: "",
        status: "failed",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "failed" },
      });
  }
};
