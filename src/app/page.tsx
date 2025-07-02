"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Wand2, Loader2 } from "lucide-react";
import { FileUpload } from "~/components/file-upload";
import { GeneratedContent } from "~/components/generated-content";
import { z_contentResponse, z_generateContentInterface } from "~/ai/validation";
import axios from "axios";
import Swal from "sweetalert";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

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
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState(predefinedTones[4]);
  const [customTone, setCustomTone] = useState("");
  const [imageStyle, setImageStyle] = useState("realistic");
  const [voiceStyle, setVoiceStyle] = useState("professional");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    headline?: string;
    caption?: string;
    imageUrl?: string;
    audioUrl?: string;
  }>({});

  console.log({ generatedContent });

  const [imageStatus, setImageStatus] = useState<
    "idle" | "pending" | "error" | "timeout"
  >("idle");
  const [audioLoading, setAudioLoading] = useState<
    "idle" | "pending" | "error" | "timeout"
  >("idle");

  const router = useRouter();

  const imageStyles = [
    { value: "realistic", label: "Realistic" },
    { value: "3d", label: "3D Render" },
    { value: "illustration", label: "Illustration" },
    { value: "cartoon", label: "Cartoon" },
    { value: "abstract", label: "Abstract" },
    { value: "minimalist", label: "Minimalist" },
  ];

  const voiceStyles = [
    { value: "professional", label: "Professional" },
    { value: "friendly", label: "Friendly" },
    { value: "energetic", label: "Energetic" },
    { value: "calm", label: "Calm" },
    { value: "authoritative", label: "Authoritative" },
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setGeneratedContent({});

    try {
      const selectedTone = tone === "custom" ? customTone : tone;

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
      });

      const data = await response.json();
      setGeneratedContent(data);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const { mutateAsync: fetchStatus, reset } = api.chat.getStatus.useMutation({
    onMutate(variables) {
      if (variables?.mediaType === "image") {
        setImageStatus("pending");
      }
      if (variables?.mediaType === "audio") {
        setAudioLoading("pending");
      }
    },
    onSuccess(variables) {
      if (variables?.type === "image" && variables?.status === "completed") {
        setImageStatus("idle");
      }
      if (variables?.type === "audio" && variables?.status === "completed") {
        setAudioLoading("idle");
      }
    },
    onError(error, variables, context) {
      if (variables?.mediaType === "image") {
        setImageStatus("error");
      }
      if (variables?.mediaType === "audio") {
        setAudioLoading("error");
      }
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="mx-p container px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-4xl font-bold text-transparent">
            Multimodal Content Generator
          </h1>
          <p className="text-lg text-gray-600">
            Transform your ideas into compelling marketing content with AI
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Section */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsGenerating(true);

              try {
                const data = await axios.post(
                  "/api/generate-content",
                  z_generateContentInterface.parse({
                    prompt,
                    tone: tone === "custom" ? customTone : tone,
                    imageStyle,
                    voiceStyle,
                  }),
                );

                const contentResponse = z_contentResponse.parse(data.data);

                // Iniitalize chatId if not present
                router.replace(`?chatId=${contentResponse?.chatId}`);
                setGeneratedContent((prev) => ({
                  ...prev,
                  headline: contentResponse.result.headline,
                  caption: contentResponse.result.caption,
                }));

                const startTime = Date.now(); // Track polling start time
                while (
                  (!generatedContent.imageUrl || !generatedContent.audioUrl) &&
                  Date.now() - startTime < 60000 // 60 seconds
                ) {
                  reset();
                  // Wait for a short period before checking status again
                  await new Promise((resolve) => setTimeout(resolve, 5000));

                  // Run this path only if imageUrl has not been set
                  if (!generatedContent.imageUrl) {
                    const response = await fetchStatus({
                      chatID: contentResponse.chatId,
                      mediaID: contentResponse.imageIndex,
                      mediaType: "image",
                    });

                    console.log({
                      status: response,
                    });
                    if (response?.status === "completed") {
                      setGeneratedContent((prev) => ({
                        ...prev,
                        imageUrl: response.url,
                      }));
                    }
                  }

                  // Run this path only if audio has not been set
                  if (!generatedContent.audioUrl) {
                    const response = await fetchStatus({
                      chatID: contentResponse.chatId,
                      mediaID: contentResponse.imageIndex,
                      mediaType: "audio",
                    });
                    console.log({
                      status: response,
                    });
                    if (response?.status === "completed") {
                      setGeneratedContent((prev) => ({
                        ...prev,
                        audioUrl: response?.url,
                      }));
                    }
                  }
                }
                // After loop, if timeout occurred, set missing fields to 'timeout'
                if (!generatedContent.imageUrl) {
                  setImageStatus("timeout");
                }
                if (!generatedContent.audioUrl) {
                  setAudioLoading("timeout");
                }

                Swal({
                  icon: "success",
                  title: "Content Generated Successfully",
                  text: "Your content has been generated and is ready for review.",
                });

                console.log({ content: data?.data });
              } catch (err) {
                console.error("Error generating content", err);
                Swal({
                  icon: "error",
                  title: "Content Generation Failed",
                  text: "Please check your input and try again.",
                });
              } finally {
                setIsGenerating(false);
              }
            }}
            className=""
          >
            <Card className="h-fit">
              <CardHeader className="flex flex-row justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  Content Configuration
                </CardTitle>
                <Button
                  type="submit"
                  // Uncomment the line below to enable the button click handler
                  // onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="w-min cursor-pointer rounded px-2"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Content...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate Content
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Prompt Input */}
                <div className="space-y-2">
                  <Label htmlFor="prompt">Product or Idea Prompt</Label>
                  <Textarea
                    required
                    id="prompt"
                    placeholder="e.g., A smart water bottle that tracks hydration and reminds you to drink water"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                {/* File Upload */}
                <FileUpload
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                />
                {/* Tone Selection */}
                <div className="space-y-3">
                  <Label>Content Tone</Label>
                  <div className="flex flex-wrap gap-2">
                    {predefinedTones.map((t) => (
                      <Badge
                        key={t}
                        variant={tone === t ? "default" : "outline"}
                        className="hover:bg-primary/10 cursor-pointer"
                        onClick={() => setTone(t)}
                      >
                        {t}
                      </Badge>
                    ))}
                    <Badge
                      variant={tone === "custom" ? "default" : "outline"}
                      className="hover:bg-primary/10 cursor-pointer"
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
                <Button
                  type="submit"
                  // Uncomment the line below to enable the button click handler
                  // onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="w-full"
                  size="lg"
                >
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
          </form>

          {/* Generated Content Section */}
          <GeneratedContent
            content={generatedContent}
            isGenerating={isGenerating}
            onContentUpdate={setGeneratedContent}
            contentsStatus={{
              imageStatus,
              audioLoading,
            }}
            originalPrompt={prompt}
            tone={tone === "custom" ? customTone : tone}
            imageStyle={imageStyle}
            voiceStyle={voiceStyle}
          />
        </div>
      </div>
    </div>
  );
}
