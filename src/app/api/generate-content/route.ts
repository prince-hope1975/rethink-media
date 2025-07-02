import { after, NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/generate-content called");

    const body = await request.json();
    console.log("Request body:", body);

    const {
      prompt,
      tone,
      imageStyle,
      voiceStyle,
      contentLengthInSeconds,
      chatID,
    } = z_generateContentInterface.parse(body);

    console.log("Parsed request:", {
      prompt,
      tone,
      imageStyle,
      voiceStyle,
      contentLengthInSeconds,
      chatID,
    });

    const ai = new GoogleGenAI({ vertexai: false, apiKey: GEMINI_API_KEY });

    // Generate text content (headline and caption)
    const textPrompt = `
    You are a marketing expert specializing in creating engaging content for various brands. Your task is to generate compelling marketing content based on the provided prompt and tone.
    Use the following guidelines:
      - Focus on creating a catchy headline and a concise caption that captures the essence of the brand.
      - Ensure the content is tailored to the specified tone, whether it's playful, serious, bold, professional, or any other specified tone.
      - Keep the headline to a maximum of 10 words and the caption to 2-3 sentences.

      Now, based on the provided prompt and tone, generate the marketing content:
      Create marketing content for: ${prompt}
      
      Tone: ${tone}
      
      Generate:
      1. A compelling marketing headline (max 10 words)
      2. A marketing caption (2-3 sentences)
      3. An image prompt for a 3D digital art style that complements the content.
      4. An audio prompt for a voiceover ${contentLengthInSeconds} sec long that matches the tone and content, it should detail the what is to be said and the time where it should be said.
      
      Format your response as JSON with "headline" and "caption" fields.
      !Important: Ensure the content is engaging and suitable for a marketing campaign.

      !IMPORTANT: Do not include any additional text or explanations in your response. Only return the JSON object with the SPECIFIC fields "headline", "caption","audioPrompt", "voiceStyle" and "imagePrompt" all in a single object NO NESTED OBJECTS!!!.
    `;
    console.log("Sending prompt to Gemini:", textPrompt);

    const results = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: textPrompt,
      config: {
        responseModalities: [Modality.TEXT],
      },
    });
    console.log("Gemini response:", results);

    if (!results || !results.text) {
      console.error("No text content generated from AI response", results);
      throw new Error("No text content generated from AI response");
    }

    let jsonText = results?.text?.trim();
    if (!jsonText) {
      console.error("No text content in Gemini response:", results);
      throw new Error("No text content generated from AI response");
    }
    const firstBrace = jsonText?.indexOf("{") ?? 0;
    const lastBrace = jsonText?.lastIndexOf("}") ?? results?.text?.length;
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText?.slice(firstBrace, lastBrace + 1);
    }
    let content: {
      headline: string;
      caption: string;
      audioPrompt: string;
      imagePrompt: string;
      voiceStyle: string;
    };
    try {
      content = JSON.parse(jsonText);
      console.log("Parsed content from Gemini:", content);
    } catch (e) {
      console.error("Failed to parse JSON from AI response:", jsonText, e);
      throw new Error("Failed to parse JSON from AI response");
    }

    // Checks if chatID exists, if not, create a new chat entry
    let databaseInfo;
    if (!chatID) {
      console.log(
        "No chatID provided, inserting new chat with headline:",
        content.headline,
      );
      databaseInfo = await db
        .insert(chat)
        .values({ name: content.headline })
        .returning();
      console.log("Inserted chat:", databaseInfo);
    } else {
      databaseInfo = [{ id: chatID }];
      console.log("Using provided chatID:", chatID);
    }

    const dataBaseID = databaseInfo.at(0)?.id!;
    console.log("Database chat ID:", dataBaseID);

    // Get the last index for image and audio in parallel
    const [lastImageIndex, lastAudioIndex] = await Promise.all([
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, dataBaseID), eq(media.type, "image")))
        .orderBy(desc(media.index))
        .limit(1),
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, dataBaseID), eq(media.type, "audio")))
        .orderBy(desc(media.index))
        .limit(1),
    ]);
    console.log(
      "Last image index:",
      lastImageIndex,
      "Last audio index:",
      lastAudioIndex,
    );

    after(async () => {
      await Promise.allSettled([
        generateAndStoreImage({
          content,
          dataBaseID,
          lastImageIndex,
        }),
        generateAndStoreAudio({
          content,
          dataBaseID,
          lastAudioIndex,
        }),
      ]);
    });

    const responsePayload = {
      result: content,
      chatId: databaseInfo.at(0)?.id,
      imageIndex: (lastImageIndex.at(0)?.index ?? 0) + 1,
      audioIndex: (lastAudioIndex.at(0)?.index ?? 0) + 1,
    };
    console.log("Returning response:", responsePayload);

    return NextResponse.json(z_contentResponse.parse(responsePayload));
  } catch (error) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      // @ts-expect-error - error is not typed
      { error: "Failed to generate content", details: error?.message || error },
      { status: 500 },
    );
  }
}

// Type definitions for the standalone functions
interface GenerateAndStoreImageParams {
  content: { imagePrompt: string };
  dataBaseID: number;
  lastImageIndex: any;
}

interface GenerateAndStoreAudioParams {
  content: { audioPrompt: string };
  dataBaseID: number;
  lastAudioIndex: any;
}

// Standalone function for image generation and storage
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
        url: blob.url,
        status: "completed",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "completed", url: blob.url },
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
        url: "",
        status: "failed",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "failed" },
      });
  }
};

// Standalone function for audio generation and storage
export const generateAndStoreAudio = async ({
  content,
  dataBaseID,
  lastAudioIndex,
}: GenerateAndStoreAudioParams) => {
  try {
    // console.log("Generating audio with prompt:", content.audioPrompt);
    // if (!content.audioPrompt) {
    //   throw new Error("Audio prompt is missing in the generated content");
    // }
    // const audioData = await generateAudioTTS(content.audioPrompt);
    // console.log("Audio generation response:", audioData);

    // const audioBlob =
    //   audioData.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    // if (!audioBlob) {
    //   throw new Error("Audio generation failed or returned no data");
    // }
    // let audioBuffer = Buffer.from(audioBlob.data || "", "base64");
    // let fileExtension = mime.getExtension(audioBlob.mimeType || "");
    // if (!fileExtension) {
    //   fileExtension = "wav";
    //   audioBuffer = convertToWav(
    //     audioBlob.data || "",
    //     audioBlob.mimeType || "",
    //   );
    // }

    // console.log("Uploading audio to Vercel Blob...");
    // const vercelBlob = await put(
    //   `chat-${dataBaseID}-audio-${Date.now()}.mp3`,
    //   audioBuffer,
    //   {
    //     access: "public",
    //     contentType: "audio/mpeg",
    //   },
    // );
    // console.log("Audio uploaded to Vercel Blob:", vercelBlob.url);

    const url = `https://0m2e0oeabi6e4rw9.public.blob.vercel-storage.com/chat-15-audio-1751482405415.mp3`;
    const result = await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
        type: "audio",
        // url: vercelBlob.url,
        url: url,
        status: "completed",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: {
          status: "completed",
          url: url,
          // url: vercelBlob.url
        },
      });

    console.log("Audio media record inserted");
  } catch (err) {
    console.error("Error in generateAndStoreAudio:", err);
    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
        type: "audio",
        status: "failed",
        url: "",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "failed" },
      });
  }
};
