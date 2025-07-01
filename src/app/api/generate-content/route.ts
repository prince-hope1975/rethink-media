import { after, NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";

import { z_contentResponse, z_generateContentInterface } from "~/ai/validation";
import { GoogleGenAI, Modality } from "@google/genai";
import { generateAudioTTS } from "~/ai/apis/generateAudioTextToSpeech";
import { chat, media } from "~/server/db/schema";
import { db } from "~/server/db";
import { and, desc, eq } from "drizzle-orm";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { prompt, tone, imageStyle, voiceStyle, contentLengthInSeconds } =
      z_generateContentInterface.parse(await request.json());

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

      !IMPORTANT: Do not include any additional text or explanations in your response. Only return the JSON object with the fields "headline", "caption","audioPrompt" and "imagePrompt".
    `;

    const results = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: textPrompt,
      config: {
        responseModalities: [Modality.TEXT],
      },
    });
    const databaseInfo = await db.insert(chat).values({}).returning();
    const dataBaseID = databaseInfo.at(0)?.id!;

    // Extract JSON from results.text
    let jsonText = results?.text?.trim();
    if (!jsonText) {
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
    };
    try {
      content = JSON.parse(jsonText);
    } catch (e) {
      throw new Error("Failed to parse JSON from AI response");
    }

    // Here we call the image and audio generation APIs
    after(async () => {
      const generateAndStoreImage = async () => {
        if (!content.imagePrompt) {
          throw new Error("Image prompt is missing in the generated content");
        }

        const imgContent = await ai.models.generateImages({
          model: "imagen-4.0-generate-002",
          prompt: content.imagePrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
            aspectRatio: "1:1",
          },
        });

        const imageBytes = imgContent?.generatedImages?.[0]?.imageBytes;
        if (!imageBytes) {
          throw new Error("Image generation failed");
        }

        // Convert base64 to Buffer if needed
        const buffer =
          typeof imageBytes === "string"
            ? Buffer.from(imageBytes, "base64")
            : imageBytes;

        // Upload to Vercel Blob
        const blob = await put(
          `chat-${dataBaseID}-image-${Date.now()}.jpg`,
          buffer,
          {
            access: "public",
            contentType: "image/jpeg",
          }
        );

        // Get the last index for this chat and type
        const lastIndex = await db
          .select({ index: media.index })
          .from(media)
          .where(and(eq(media.chatId, dataBaseID), eq(media.type, "image")))
          .orderBy(desc(media.index))
          .limit(1);

        // Insert media record with incremented index
        await db.insert(media).values({
          chatId: dataBaseID,
          index: (lastIndex.at(0)?.index ?? 0) + 1,
          type: "image",
          url: blob.url,
          // add other fields if needed
        });
      };

      const generateAndStoreAudio = () => {
        if (!content.imagePrompt) {
          throw new Error("Image prompt is missing in the generated content");
        }
        const audioContent = generateAudioTTS(content.audioPrompt);
      };

      // Call the image generation/upload function
      await generateAndStoreImage();
    });

    return NextResponse.json(
      z_contentResponse.parse({
        result: content,
        chatId: databaseInfo.at(0)?.id,
      })
    );

    // let textContent;
    // try {

    //   textContent = JSON.parse(textResult.text);
    // } catch {
    //   // Fallback if JSON parsing fails
    //   const lines = textResult.text.split("\n").filter((line) => line.trim());
    //   textContent = {
    //     headline: lines[0] || "Amazing Product Launch",
    //     caption:
    //       lines.slice(1).join(" ") || "Discover something incredible today.",
    //   };
    // }

    // // Generate image
    // const imagePrompt = `${prompt}, ${imageStyle} style, high quality, marketing photo, professional lighting`;

    // const imageResult = await fal.subscribe("fal-ai/flux/schnell", {
    //   input: {
    //     prompt: imagePrompt,
    //     image_size: "landscape_4_3",
    //     num_inference_steps: 4,
    //     num_images: 1,
    //   },
    // });

    // const imageUrl =
    //   imageResult.data?.images?.[0]?.url ||
    //   "/placeholder.svg?height=400&width=600";

    // // Simulate audio generation (in a real app, you'd use a TTS service)
    // const audioUrl = await generateAudioPlaceholder(
    //   textContent.caption,
    //   voiceStyle
    // );

    // return NextResponse.json({
    //   headline: textContent.headline,
    //   caption: textContent.caption,
    //   imageUrl,
    //   audioUrl,
    // });
  } catch (error) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}

// Placeholder function for audio generation
async function generateAudioPlaceholder(
  text: string,
  voiceStyle: string
): Promise<string> {
  // In a real implementation, you would:
  // 1. Use a TTS service like ElevenLabs, OpenAI TTS, or similar
  // 2. Convert the text to speech with the specified voice style
  // 3. Return the audio URL

  // For now, return a placeholder audio URL
  return "/placeholder-audio.mp3";
}
