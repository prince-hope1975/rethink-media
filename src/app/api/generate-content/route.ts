import { after, NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import mime from "mime";

import {
  z_headline_and_caption,
  z_contentResponse,
  z_generateContentInterface,
} from "~/ai/validation";
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
      mediaStyle: meiaStyle,
      voiceStyle,
      contentLengthInSeconds,
      chatID,
      mediaType,
    } = z_generateContentInterface.parse(body);

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
      3. ${mediaType == "image" ? "An image" : "A detailed video"} prompt for a ${meiaStyle ?? "3D digital art"} style that complements the content.
      4. An audio prompt for a voiceover ${contentLengthInSeconds} sec long that matches the tone and content, it should detail the what is to be said and the time where it should be said.
      
      Format your response as JSON with "headline" and "caption" fields.
      !Important: Ensure the content is engaging and suitable for a marketing campaign.

      !IMPORTANT: Do not include any additional text or explanations in your response. Only return the JSON object with the SPECIFIC fields "headline", "caption","audioPrompt", "voiceStyle" and "mediaPrompt" all in a single object NO NESTED OBJECTS!!!.

      ${mediaType == "video" && `!VERY IMPORTANT FOR VIDEOS, THE VIDEOS PROMPT SHOULD NOT INCLUDE ANY TEXT, AND SHOULD BE VERY DETAILED. Here is an example of how the video prompt should be structured:"A man stands waist-deep in a crystal-clear mountain pool, his back turned to a massive, thundering waterfall that cascades down jagged cliffs behind him. He wears a dark blue swimming shorts and his muscular back glistens with water droplets. The camera moves in a dynamic circular motion around him, starting from his right side and sweeping left, maintaining a slightly low angle that emphasizes the towering height of the waterfall. As the camera moves, the man slowly turns his head to follow its movement, his expression one of awe as he gazes up at the natural wonder. The waterfall creates a misty atmosphere, with sunlight filtering through the spray to create rainbow refractions. The water churns and ripples around him, reflecting the dramatic landscape. The handheld camera movement adds a subtle shake that enhances the raw, untamed energy of the scene. The lighting is natural and bright, with the sun positioned behind the waterfall, creating a backlit effect that silhouettes the falling water and illuminates the mist." `}
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
      mediaPrompt: string;
      voiceStyle: string;
    };
    try {
      content = JSON.parse(jsonText);
    } catch (e) {
      console.error("Failed to parse JSON from AI response:", jsonText, e);
      throw new Error("Failed to parse JSON from AI response");
    }

    // Checks if chatID exists, if not, create a new chat entry
    let databaseInfo;
    if (!chatID) {
      databaseInfo = await db
        .insert(chat)
        .values({ name: content.headline })
        .returning();
      console.log("Inserted chat:", databaseInfo);
    } else {
      databaseInfo = await db
        .update(chat)
        .set({ name: content.headline })
        .where(eq(chat.id, chatID))
        .returning();
      console.log("Using provided chatID:", chatID);
    }

    const dataBaseID = databaseInfo.at(0)?.id!;
    console.log("Database chat ID:", dataBaseID);

    // Get the last index for image and audio in parallel
    const [lastMediaIndex, lastAudioIndex, lastTextIndex] = await Promise.all([
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, dataBaseID), eq(media.type, mediaType)))
        .orderBy(desc(media.index))
        .limit(1),
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, dataBaseID), eq(media.type, "audio")))
        .orderBy(desc(media.index))
        .limit(1),
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, dataBaseID), eq(media.type, "text")))
        .orderBy(desc(media.index))
        .limit(1),
    ]);

    await storeHeadlineAndCaption({
      content: {
        caption: content.caption,
        headline: content.headline,
      },
      dataBaseID,
      lastTextIndex,
    });
    console.log("Stored headlines and throwing error");
    console.log({
      content: {
        caption: content.caption,
        headline: content.headline,
      },
      dataBaseID,
      lastTextIndex,
    });

    // Mechanism for switching between image and video
    const mediaCall = async (mediaType: "video" | "image") => {
      if (mediaType == "video") {
        await generateAndStoreVideo({
          content: { videoPrompt: content.mediaPrompt },
          dataBaseID,
          lastImageIndex: lastMediaIndex,
        });
      } else {
        await generateAndStoreImage({
          content: { imagePrompt: content.mediaPrompt },
          dataBaseID,
          lastImageIndex: lastMediaIndex,
        });
      }
    };

    after(async () => {
      await Promise.allSettled([
        mediaCall(mediaType),

        generateAndStoreAudio({
          content,
          dataBaseID,
          lastAudioIndex,
        }),
        ,
      ]);
    });

    const responsePayload = {
      result: content,
      chatId: databaseInfo.at(0)?.id,
      mediaIndex: (lastMediaIndex.at(0)?.index ?? 0) + 1,
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
interface GenerateAndStoreVideoParams {
  content: { videoPrompt: string };
  dataBaseID: number;
  lastImageIndex: any;
}
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
interface StoreHeadlineAndCaptionParams {
  content: { headline: string; caption: string };
  dataBaseID: number;
  lastTextIndex: {
    index: number;
  }[];
}

// Standalone function for video generation and storage
export const generateAndStoreVideo = async ({
  content,
  dataBaseID,
  lastImageIndex,
}: GenerateAndStoreVideoParams) => {
  try {
    // const ai = new GoogleGenAI({ vertexai: false, apiKey: GEMINI_API_KEY });

    if (!content.videoPrompt) {
      throw new Error("Image prompt is missing in the generated content");
    }
    await db.insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastImageIndex.at(0)?.index ?? 0) + 1,
        type: "video",
        status: "pending",
        content_or_url: "",
        prompt: content.videoPrompt,
      })
      
    const result = await fal.subscribe("fal-ai/ltx-video", {
      input: {
        prompt: content.videoPrompt,
      },
      logs: true,
      // onQueueUpdate: (update) => {
      //   if (update.status === "IN_PROGRESS") {
      //     update.logs.map((log) => log.message).forEach(console.log);
      //   }
      // },
    });
    const videoFile = result.data.video;

    // Download the video file from the returned URL
    const videoResponse = await fetch(videoFile.url);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video from ${videoFile.url}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // Upload the video to Vercel Blob
    console.log("Uploading video to Vercel Blob...");
    const blob = await put(
      `chat-${dataBaseID}-video-${Date.now()}.mp4`,
      videoBuffer,
      {
        access: "public",
        contentType: "video/mp4",
      },
    );
    console.log("Video uploaded to:", blob.url);

    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastImageIndex.at(0)?.index ?? 0) + 1,
        type: "video",
        content_or_url: blob.url, // Use the Vercel Blob URL
        status: "completed",
        prompt: content.videoPrompt,
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "completed", content_or_url: blob.url },
      });
    console.log("video media record inserted");
  } catch (err) {
    console.error("Error in generateAndStoreImage:", err);
    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastImageIndex.at(0)?.index ?? 0) + 1,
        type: "video",
        content_or_url: "",
        status: "failed",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "failed" },
      });
  }
};
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
    await db.insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastImageIndex.at(0)?.index ?? 0) + 1,
        type: "image",
        status: "pending",
        content_or_url: "",
        prompt: content.imagePrompt,
      })
      
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

// Standalone function for audio generation and storage
export const generateAndStoreAudio = async ({
  content,
  dataBaseID,
  lastAudioIndex,
}: GenerateAndStoreAudioParams) => {
  try {
    console.log("Generating audio with prompt:", content.audioPrompt);
    if (!content.audioPrompt) {
      throw new Error("Audio prompt is missing in the generated content");
    }
    await db
    .insert(media)
    .values({
      chatId: dataBaseID,
      index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
      type: "audio",
      // content_or_url: vercelBlob.url,
      content_or_url: "",
      status: "processing",
      prompt: content.audioPrompt,
    })
    const audioData = await generateAudioTTS(content.audioPrompt);
    console.log("Audio generation response:", audioData);

    const audioBlob =
      audioData.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioBlob) {
      throw new Error("Audio generation failed or returned no data");
    }
    let audioBuffer = Buffer.from(audioBlob.data || "", "base64");
    let fileExtension = mime.getExtension(audioBlob.mimeType || "");
    if (!fileExtension) {
      fileExtension = "wav";
      audioBuffer = convertToWav(
        audioBlob.data || "",
        audioBlob.mimeType || "",
      );
    }

    console.log("Uploading audio to Vercel Blob...");
    const vercelBlob = await put(
      `chat-${dataBaseID}-audio-${Date.now()}.mp3`,
      audioBuffer,
      {
        access: "public",
        contentType: "audio/mpeg",
      },
    );
    console.log("Audio uploaded to Vercel Blob:", vercelBlob.url);

    const url = vercelBlob.url;
    // const url = `https://0m2e0oeabi6e4rw9.public.blob.vercel-storage.com/chat-15-audio-1751482405415.mp3`;
    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
        type: "audio",
        // content_or_url: vercelBlob.url,
        content_or_url: url,
        status: "completed",
        prompt: content.audioPrompt,
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: {
          status: "completed",
          content_or_url: url,
          // content_or_url: vercelBlob.url
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
        prompt: content.audioPrompt,
        content_or_url: "",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "failed" },
      });
  }
};

export const storeHeadlineAndCaption = async ({
  content,
  dataBaseID,
  lastTextIndex,
}: StoreHeadlineAndCaptionParams) => {
  try {
    await db.insert(media).values({
      chatId: dataBaseID,
      index: (lastTextIndex.at(0)?.index ?? 0) + 1,
      type: "text",
      status: "completed",
      content_or_url: JSON.stringify(
        z_headline_and_caption.parse({
          caption: content?.caption,
          headline: content?.headline,
        } as typeof z_headline_and_caption._type),
      ),
    });
    console.log("This path");
  } catch (error) {
    console.log("failed insertion", { error });
    await db.insert(media).values({
      chatId: dataBaseID,
      index: (lastTextIndex.at(0)?.index ?? 0) + 1,
      type: "text",
      status: "failed",
      content_or_url: JSON.stringify(
        z_headline_and_caption.parse({
          caption: content?.caption,
          headline: content?.headline,
        } as typeof z_headline_and_caption._type),
      ),
    });
    throw error;
  }
};
