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
import { storeHeadlineAndCaption } from "../helpers/storeHeadlineAndCaption";
interface GenerateAndStoreAudioParams {
    content: { audioPrompt: string };
    dataBaseID: number;
    lastAudioIndex: any;
  }
export const generateAndStoreAudioVoice = async ({
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