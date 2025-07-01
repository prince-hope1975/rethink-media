"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Loader2, Wand2 } from "lucide-react"

interface ContentGeneratorProps {
  onGenerate: (prompt: string, options: any) => void
  isGenerating: boolean
}

export function ContentGenerator({ onGenerate, isGenerating }: ContentGeneratorProps) {
  const [prompt, setPrompt] = useState("")
  const [options, setOptions] = useState({
    tone: "professional",
    imageStyle: "realistic",
    voiceStyle: "professional",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      onGenerate(prompt, options)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Generator</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Product or Idea</Label>
            <Textarea
              id="prompt"
              placeholder="Describe your product or idea..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <Button type="submit" disabled={!prompt.trim() || isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Content
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
