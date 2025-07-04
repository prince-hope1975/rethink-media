import { after, NextRequest, NextResponse } from "next/server";
import {
  z_contentResponse,
  z_generateAudioInterface, // We'll use this for prompt and chatID, but ignore audioType
} from "~/ai/validation";
import { media } from "~/server/db/schema";
import { db } from "~/server/db";
import { and, desc, eq } from "drizzle-orm";

// import {
//   // ,
//   generateAndStoreImage,
// } from "../../generate-content/route";
import { generateAndStoreVideo } from "../../helpers/generateAndStoreVideo";
import { generateAndStoreImage } from "../../helpers/generateAndStoreImage";
// generateAndStoreVideo
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[MEDIA ENDPOINT] Request body:", body);
    // Accept mediaType: 'image' | 'video', prompt, chatID
    const { prompt, chatID, mediaType } = {
      ...z_generateAudioInterface
        .pick({ prompt: true, chatID: true })
        .parse(body),
      mediaType: body.mediaType,
    };
    console.log("[MEDIA ENDPOINT] Parsed:", { prompt, chatID, mediaType });
    if (typeof chatID !== "number") {
      console.error("[MEDIA ENDPOINT] chatID is not a number:", chatID);
      throw new Error("chatID is required and must be a number");
    }
    if (mediaType !== "image" && mediaType !== "video") {
      console.error("[MEDIA ENDPOINT] Invalid mediaType:", mediaType);
      throw new Error("mediaType must be 'image' or 'video'");
    }

    // Get the last index for the requested media type
    console.log("[MEDIA ENDPOINT] Querying last media index for", {
      chatID,
      mediaType,
    });
    const [lastMediaIndex] = await Promise.all([
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, chatID), eq(media.type, mediaType)))
        .orderBy(desc(media.index))
        .limit(1),
    ]);
    console.log("[MEDIA ENDPOINT] Last media index:", lastMediaIndex);

    const mediaCall = async () => {
      if (mediaType === "video") {
        console.log("[MEDIA ENDPOINT] Calling generateAndStoreVideo");
        await generateAndStoreVideo({
          content: { videoPrompt: prompt },
          dataBaseID: chatID,
          lastImageIndex: lastMediaIndex,
        });
        console.log("[MEDIA ENDPOINT] Finished generateAndStoreVideo");
      } else {
        console.log("[MEDIA ENDPOINT] Calling generateAndStoreImage");
        await generateAndStoreImage({
          content: { imagePrompt: prompt },
          dataBaseID: chatID,
          lastImageIndex: lastMediaIndex,
        });
        console.log("[MEDIA ENDPOINT] Finished generateAndStoreImage");
      }
    };

    after(async () => {
      await Promise.allSettled([mediaCall()]);
      console.log("[MEDIA ENDPOINT] after() Promise.allSettled complete");
    });

    const responsePayload = {
      result: true,
      chatId: chatID,
      mediaIndex: (lastMediaIndex.at(0)?.index ?? 0) + 1,
      mediaType,
    };
    console.log("[MEDIA ENDPOINT] Returning response:", responsePayload);
    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error(
      "[MEDIA ENDPOINT] Error caught:",
      error && error.stack ? error.stack : error,
    );
    const details =
      typeof error === "object" && error && "message" in error
        ? (error as any).message
        : String(error);
    return NextResponse.json(
      { error: "Failed to generate media", details },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Implementation of GET method
}

export async function PUT(request: NextRequest) {
  // Implementation of PUT method
}
