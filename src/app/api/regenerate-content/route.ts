import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { fal } from "@fal-ai/client"

export async function POST(request: NextRequest) {
  try {
    const { type, originalPrompt, tone, imageStyle, voiceStyle, currentContent } = await request.json()

    switch (type) {
      case "headline":
        const headlineResult = await generateText({
          model: openai("gpt-4o"),
          prompt: `Create a different marketing headline for: ${originalPrompt}
                   Tone: ${tone}
                   Make it compelling and different from: "${currentContent.headline}"
                   Max 10 words.`,
        })
        return NextResponse.json({ headline: headlineResult.text.trim() })

      case "caption":
        const captionResult = await generateText({
          model: openai("gpt-4o"),
          prompt: `Create a different marketing caption for: ${originalPrompt}
                   Tone: ${tone}
                   Make it different from: "${currentContent.caption}"
                   2-3 sentences.`,
        })
        return NextResponse.json({ caption: captionResult.text.trim() })

      case "image":
        const imagePrompt = `${originalPrompt}, ${imageStyle} style, high quality, marketing photo, professional lighting, variation`

        const imageResult = await fal.subscribe("fal-ai/flux/schnell", {
          input: {
            prompt: imagePrompt,
            image_size: "landscape_4_3",
            num_inference_steps: 4,
            num_images: 1,
          },
        })

        const imageUrl = imageResult.data?.images?.[0]?.url || "/placeholder.svg?height=400&width=600"
        return NextResponse.json({ imageUrl })

      case "audio":
        // Simulate audio regeneration
        const audioUrl = await generateAudioPlaceholder(currentContent.caption, voiceStyle)
        return NextResponse.json({ audioUrl })

      default:
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Content regeneration error:", error)
    return NextResponse.json({ error: "Failed to regenerate content" }, { status: 500 })
  }
}

async function generateAudioPlaceholder(text: string, voiceStyle: string): Promise<string> {
  return "/placeholder-audio.mp3"
}
