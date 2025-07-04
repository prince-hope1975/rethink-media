import { after, NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import mime from "mime";

import {
  z_contentResponse,
  z_generateAudioInterface,
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
    const body = await request.json();
    console.log("Request body:", body);

    const { prompt, audioType, chatID } = z_generateAudioInterface.parse(body);
    if (typeof chatID !== "number") {
      throw new Error("chatID is required and must be a number");
    }

    // Checks if chatID exists, if not, create a new chat entry

    // Get the last index for image and audio in parallel
    const [lastAudioIndex] = await Promise.all([
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, chatID), eq(media.type, "audio")))
        .orderBy(desc(media.index))
        .limit(1),
    ]);

    // Mechanism for switching between image and video

    const voiceCall = async (audioType: "jingle" | "voice") => {
      if (audioType == "jingle") {
        await generateAndStoreAudioJingle({
          content: { audioPrompt: prompt },
          dataBaseID: chatID!,
          lastAudioIndex: lastAudioIndex,
        });
      } else {
        await generateAndStoreAudioVoice({
          content: { audioPrompt: prompt },
          dataBaseID: chatID!,
          lastAudioIndex: lastAudioIndex,
        });
      }
    };

    after(async () => {
      await Promise.allSettled([voiceCall(audioType)]);
    });

    const responsePayload = {
      result: true,
      chatId: chatID,
      audioIndex: (lastAudioIndex.at(0)?.index ?? 0) + 1,
    };
    console.log("Returning response:", responsePayload);

    return NextResponse.json(responsePayload);
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


// Standalone function for video generation and storage
 const generateAndStoreVideo = async ({
  content,
  dataBaseID,
  lastImageIndex,
}: GenerateAndStoreVideoParams) => {
  try {
    // const ai = new GoogleGenAI({ vertexai: false, apiKey: GEMINI_API_KEY });

    if (!content.videoPrompt) {
      throw new Error("Image prompt is missing in the generated content");
    }
    await db.insert(media).values({
      chatId: dataBaseID,
      index: (lastImageIndex.at(0)?.index ?? 0) + 1,
      type: "video",
      status: "pending",
      content_or_url: "",
      prompt: content.videoPrompt,
    });

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
 const generateAndStoreImage = async ({
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

// Standalone function for audio generation and storage
 const generateAndStoreAudioVoice = async ({
  content,
  dataBaseID,
  lastAudioIndex,
}: GenerateAndStoreAudioParams) => {
  try {
    console.log("Generating audio with prompt:", content.audioPrompt);
    if (!content.audioPrompt) {
      throw new Error("Audio prompt is missing in the generated content");
    }
    await db.insert(media).values({
      chatId: dataBaseID,
      index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
      type: "audio",
      // content_or_url: vercelBlob.url,
      content_or_url: "",
      status: "processing",
      prompt: content.audioPrompt,
    });
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
// Standalone function for video generation and storage
 const generateAndStoreAudioJingle = async ({
  content,
  dataBaseID,
  lastAudioIndex,
}: GenerateAndStoreAudioParams) => {
  try {
    // const ai = new GoogleGenAI({ vertexai: false, apiKey: GEMINI_API_KEY });

    if (!content.audioPrompt) {
      throw new Error("Image prompt is missing in the generated content");
    }
    await db.insert(media).values({
      chatId: dataBaseID,
      index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
      type: "audio",
      status: "pending",
      content_or_url: "",
      prompt: content.audioPrompt,
    });

    console.log({ content });
    const result = await fal.subscribe("fal-ai/stable-audio", {
      input: {
        prompt: content.audioPrompt,
        seconds_total: 5,
      },
      logs: true,
      // onQueueUpdate: (update) => {
      //   if (update.status === "IN_PROGRESS") {
      //     update.logs.map((log) => log.message).forEach(console.log);
      //   }
      // },
    });
    const audioFile = result.data.audio_file;

    // Download the video file from the returned URL
    const audioResponse = await fetch(audioFile.url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download video from ${audioFile.url}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Upload the video to Vercel Blob
    console.log("Uploading video to Vercel Blob...");
    const blob = await put(
      `chat-${dataBaseID}-audio-${Date.now()}.mp3`,
      audioBuffer,
      {
        access: "public",
        contentType: "audio/mpeg",
      },
    );
    console.log("audio uploaded to:", blob.url);

    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
        type: "audio",
        content_or_url: blob.url, // Use the Vercel Blob URL
        status: "completed",
        prompt: content.audioPrompt,
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "completed", content_or_url: blob.url },
      });
    console.log("audio media record inserted");
  } catch (err) {
    console.error("Error in generating jingle:", err);
    await db
      .insert(media)
      .values({
        chatId: dataBaseID,
        index: (lastAudioIndex.at(0)?.index ?? 0) + 1,
        type: "audio",
        content_or_url: "",
        status: "failed",
      })
      .onConflictDoUpdate({
        target: [media.chatId, media.type, media.index],
        set: { status: "failed" },
      });
  }
};


