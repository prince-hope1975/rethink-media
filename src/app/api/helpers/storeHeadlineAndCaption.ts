import  { z_headline_and_caption } from "~/ai/validation";
import { db } from "~/server/db";
import { media } from "~/server/db/schema";
interface StoreHeadlineAndCaptionParams {
  content: { headline: string; caption: string };
  dataBaseID: number;
  lastTextIndex: {
    index: number;
  }[];
}

export const storeHeadlineAndCaption = async ({
  content, dataBaseID, lastTextIndex,
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
        } as typeof z_headline_and_caption._type)
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
        } as typeof z_headline_and_caption._type)
      ),
    });
    throw error;
  }
};
