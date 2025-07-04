import { after, NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import mime from "mime";

import {
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

interface GenerateAndStoreVideoParams {
    content: { videoPrompt: string };
    dataBaseID: number;
    lastImageIndex: any;
  }
  
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