ALTER TYPE "public"."media_type" ADD VALUE 'text';--> statement-breakpoint
ALTER TABLE "rethink-media_media" RENAME COLUMN "url" TO "content_or_url";