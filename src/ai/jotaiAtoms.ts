import { atom } from "jotai";
import { media } from "~/server/db/schema";
// import { api } from "~/trpc/server";
type media = typeof media._.inferSelect
export const audioDataAtom = atom<media[] | null>(null);
export const videoDataAtom = atom<media[] | null>(null);
export const imageDataAtom = atom<media[] | null>(null); 



export const audioTypeAtom = atom<"voice" | "jingle">("voice");