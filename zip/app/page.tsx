"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Badge } from "~/components/ui/badge"
import { Wand2, Loader2 } from "lucide-react"
import { FileUpload } from "~/components/file-upload"
import { GeneratedContent } from "~/components/generated-content"

export default function Home() {
  const [prompt, setPrompt] = useState("")
  const [tone, setTone] = useState("")
  const [customTone, setCustomTone] = useState("")
  const [imageStyle, setImageStyle] = useState("realistic")
  const [voiceStyle, setVoiceStyle] = useState("professional")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<{
    headline?: string
    caption?: string
    imageUrl?: string
    audioUrl?: string
  }>({})

  const predefinedTones = [
    "Playful",
    "Serious",
    "Bold",
    "Professional",
    "Casual",
    "Enthusiastic",
    "Minimalist",
    "Luxury",
    "Tech-savvy",
    "Friendly",
  ]

  const imageStyles = [
    { value: "realistic", label: "Realistic" },
    { value: "3d", label: "3D Render" },
    { value: "illustration", label: "Illustration" },
    { value: "cartoon", label: "Cartoon" },
    { value: "abstract", label: "Abstract" },
    { value: "minimalist", label: "Minimalist" },
  ]

  const voiceStyles = [
    { value: "professional", label: "Professional" },
    { value: "friendly", label: "Friendly" },
    { value: "energetic", label: "Energetic" },
    { value: "calm", label: "Calm" },
    { value: "authoritative", label: "Authoritative" },
  ]

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setGeneratedContent({})

    try {
      const selectedTone = tone === "custom" ? customTone : tone

      // Generate all content
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          tone: selectedTone,
          imageStyle,
          voiceStyle,
          files: uploadedFiles.map((f) => f.name), // In real app, you'd upload files first
        }),
      })

      const data = await response.json()
      setGeneratedContent(data)
    } catch (error) {
      console.error("Generation failed:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Multimodal Content Generator
          </h1>
          <p className="text-gray-600 text-lg">Transform your ideas into compelling marketing content with AI</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Content Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prompt Input */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Product or Idea Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g., A smart water bottle that tracks hydration and reminds you to drink water"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              {/* File Upload */}
              <FileUpload files={uploadedFiles} onFilesChange={setUploadedFiles} />

              {/* Tone Selection */}
              <div className="space-y-3">
                <Label>Content Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {predefinedTones.map((t) => (
                    <Badge
                      key={t}
                      variant={tone === t ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => setTone(t)}
                    >
                      {t}
                    </Badge>
                  ))}
                  <Badge
                    variant={tone === "custom" ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => setTone("custom")}
                  >
                    Custom
                  </Badge>
                </div>
                {tone === "custom" && (
                  <Input
                    placeholder="Enter custom tone..."
                    value={customTone}
                    onChange={(e) => setCustomTone(e.target.value)}
                  />
                )}
              </div>

              {/* Style Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Image Style</Label>
                  <Select value={imageStyle} onValueChange={setImageStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {imageStyles.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Voice Style</Label>
                  <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceStyles.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Generate Button */}
              <Button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating} className="w-full" size="lg">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Content...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Content Section */}
          <GeneratedContent
            content={generatedContent}
            isGenerating={isGenerating}
            onContentUpdate={setGeneratedContent}
            originalPrompt={prompt}
            tone={tone === "custom" ? customTone : tone}
            imageStyle={imageStyle}
            voiceStyle={voiceStyle}
          />
        </div>
      </div>
    </div>
  )
}
