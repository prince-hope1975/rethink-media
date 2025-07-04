import { after, NextRequest, NextResponse } from "next/server";

import {
  z_contentResponse,
  z_headline_and_caption,
  z_generateAudioInterface, // We'll use this for prompt and chatID
} from "~/ai/validation";
import { media } from "~/server/db/schema";
import { db } from "~/server/db";
import { and, desc, eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, chatID } = z_generateAudioInterface.pick({ prompt: true, chatID: true }).parse(body);
    if (typeof chatID !== 'number') {
      throw new Error('chatID is required and must be a number');
    }

    // Get the last index for text
    const [lastTextIndex] = await Promise.all([
      db
        .select({ index: media.index })
        .from(media)
        .where(and(eq(media.chatId, chatID), eq(media.type, "text")))
        .orderBy(desc(media.index))
        .limit(1),
    ]);

    const textCall = async () => {
      await storeHeadlineAndCaption({
        content: { headline: prompt, caption: prompt }, // In real use, parse prompt for headline/caption
        dataBaseID: chatID!,
        lastTextIndex: lastTextIndex,
      });
    };

    after(async () => {
      await Promise.allSettled([textCall()]);
    });

    const responsePayload = {
      result: true,
      chatId: chatID,
      textIndex: (lastTextIndex.at(0)?.index ?? 0) + 1,
    };
    return NextResponse.json((responsePayload));
  } catch (error: any) {
    const details = (typeof error === 'object' && error && 'message' in error) ? (error as any).message : String(error);
    return NextResponse.json(
      { error: "Failed to generate text", details },
      { status: 500 },
    );
  }
}

// Import the helper from the main generate-content route
import { storeHeadlineAndCaption } from "../../generate-content/route"; 