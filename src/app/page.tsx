"use client";

import { useEffect, useState } from "react";
import moment from "moment";
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
import { Wand2, Loader2, HelpCircle } from "lucide-react";
import { FileUpload } from "~/components/file-upload";
import { GeneratedContent } from "~/components/generated-content";
import {
  z_contentResponse,
  z_generateContentInterface,
  z_headline_and_caption,
} from "~/ai/validation";
import axios from "axios";
import Swal from "sweetalert";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useAtom } from "jotai";
import { audioDataAtom, audioTypeAtom, imageDataAtom, videoDataAtom } from "~/ai/jotaiAtoms";

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
  const [mediaStyle, setMediaStyle] = useState("realistic");
  const [voiceStyle, setVoiceStyle] = useState("professional");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    headline?: string;
    caption?: string;
    audioUrl?: string;
    audioPrompt?: string;
    mediaUrl?: string;
    mediaType?: "video" | "image";
    mediaPrompt?: string;
  }>({});

  const [mediaStatus, setMediaStatus] = useState<
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

  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [audioType, setAudioType] = useAtom<"voice" | "jingle">(audioTypeAtom);
  const searchParams = useSearchParams();
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
          imageStyle: mediaStyle,
          voiceStyle,
          files: uploadedFiles.map((f) => f.name), // In real app, you'd upload files first
          mediaType,
          audioType,
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
        setMediaStatus("pending");
      }
      if (variables?.mediaType === "audio") {
        setAudioLoading("pending");
      }
    },
    onSuccess(variables) {
      if (variables?.type === "image" && variables?.status === "completed") {
        setMediaStatus("idle");
      }
      if (variables?.type === "audio" && variables?.status === "completed") {
        setAudioLoading("idle");
      }
    },
    onError(error, variables, context) {
      if (variables?.mediaType === "image") {
        setMediaStatus("error");
      }
      if (variables?.mediaType === "audio") {
        setAudioLoading("error");
      }
    },
  });

  const chatData = api.chat.getChat.useQuery(
    { chatID: +searchParams.get("chatId")! },
    { enabled: !!searchParams.get("chatId"), refetchInterval: 30000 },
  );

  const utils = api.useUtils();
  const [audio, setAudio] = useAtom(audioDataAtom);
  const [video, setVideo] = useAtom(videoDataAtom);
  const [image, setImage] = useAtom(imageDataAtom);
  useEffect(() => {
    if (chatData?.data) {
      const audioData = chatData?.data?.media?.audio?.at(0);
      const videoData = chatData?.data?.media?.video?.at(0);
      const imageData = chatData?.data?.media?.image?.at(0);
      const captionData = chatData?.data?.media?.text?.at(0);
      setAudio(chatData?.data?.media?.audio!);
      setVideo(chatData?.data?.media!?.video);
      setImage(chatData?.data?.media!?.image);
      const mediaData = (() => {
        if (imageData?.updatedAt && videoData?.updatedAt) {
          if (moment(videoData?.updatedAt).isAfter(imageData?.updatedAt)) {
            return videoData;
          }
          return imageData;
        } else {
          if (imageData?.updatedAt) {
            return imageData;
          }
          return videoData;
        }
      })();

      const contentData = captionData?.content_or_url
        ? z_headline_and_caption.parse(JSON.parse(captionData?.content_or_url))
        : undefined;

      setGeneratedContent((prev) => {
        return {
          ...prev,
          audioPrompt: audioData?.prompt ?? undefined,
          audioUrl: audioData?.content_or_url ?? undefined,
          mediaPrompt: mediaData?.prompt ?? undefined,
          mediaType: (mediaData?.type as any) ?? undefined,
          caption: contentData?.caption ?? undefined,
          headline: chatData?.data?.chat?.name ?? undefined,
          mediaUrl: mediaData?.content_or_url ?? undefined,
        };
      });
    }
  }, [chatData.dataUpdatedAt]);

  useEffect(() => {
    setTimeout(() => {
      utils.chat.invalidate().then((res) => {
        console.log("Local invalidation");
      });
    }, 5000);
  }, ["aaahsssssss"]);

  const handleNewChat = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("chatId");
    router.replace(url.pathname);
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <div className="mx-p container px-4 py-8">
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            onClick={handleNewChat}
          >
            New Chat
          </Button>
        </div>
        <div className="animate-in fade-in slide-in-from-top-4 mb-8 text-center duration-1000">
          <h1 className="mb-2 bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-5xl font-extrabold text-transparent drop-shadow-lg">
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
              setGeneratedContent({});
              try {
                const chat_id = searchParams.get("chatId");
                const data = await axios.post(
                  "/api/generate-content",
                  z_generateContentInterface.parse({
                    prompt,
                    tone: (tone === "custom" ? customTone : tone) as any,
                    mediaStyle: mediaStyle,
                    voiceStyle,
                    mediaType,
                    audioType,
                    contentLengthInSeconds: 6,
                    chatID: !!chat_id ? parseInt(chat_id) : undefined,
                  } satisfies typeof z_generateContentInterface._type),
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

                console.log("After invalidation");
                for (let i = 0; i < 3; i++) {
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                  await utils.chat.invalidate();
                }
                // while (
                //   (!generatedContent.mediaUrl || !generatedContent.audioUrl) &&
                //   Date.now() - startTime < 60000 // 60 seconds
                // ) {
                //   reset();

                //   // Wait for a short period before checking status again
                //   console.log("invalidating");

                //   // Run this path only if imageUrl has not been set
                //   if (!generatedContent.mediaUrl) {
                //     const response = await fetchStatus({
                //       chatID: contentResponse.chatId,
                //       mediaID: contentResponse.mediaIndex,
                //       mediaType: mediaType,
                //     });

                //     console.log({
                //       status: response,
                //     });
                //     if (response?.status === "completed") {
                //       setGeneratedContent((prev) => ({
                //         ...prev,
                //         mediaUrl: response.content_or_url,
                //         mediaType: mediaType,
                //         mediaPrompt: response.prompt!,
                //       }));
                //     }
                //   }

                //   // Run this path only if audio has not been set
                //   if (!generatedContent.audioUrl) {
                //     const response = await fetchStatus({
                //       chatID: contentResponse.chatId,
                //       mediaID: contentResponse.mediaIndex,
                //       mediaType: "audio",
                //     });
                //     console.log({
                //       status: response,
                //     });
                //     if (response?.status === "completed") {
                //       setGeneratedContent((prev) => ({
                //         ...prev,
                //         audioUrl: response?.content_or_url,
                //         audioPrompt: response.prompt!,
                //       }));
                //     }
                //   }
                // }
                // After loop, if timeout occurred, set missing fields to 'timeout'
                // if (!generatedContent.mediaUrl) {
                //   setMediaStatus("timeout");
                // }
                // if (!generatedContent.audioUrl) {
                //   setAudioLoading("timeout");
                // }

              

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
                  disabled={!prompt.trim() || isGenerating}
                  className="w-fit rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-lg font-semibold text-white shadow-lg transition-all duration-300 ease-out hover:scale-105 hover:from-purple-700 hover:to-blue-700 hover:shadow-xl"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating Content...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-5 w-5" />
                      Generate Content
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 rounded-b-xl bg-gradient-to-br p-6">
                {/* Prompt Input */}
                <div className="flex items-center justify-between space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="prompt" className="font-semibold">
                      Product or Idea Prompt
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="mediaType-switch"
                      className="mr-2 font-medium"
                    >
                      {mediaType === "image" ? "Image" : "Video"}
                    </Label>
                    <Switch
                      id="mediaType-switch"
                      checked={mediaType === "video"}
                      onCheckedChange={(checked) =>
                        setMediaType(checked ? "video" : "image")
                      }
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-2 cursor-pointer align-middle text-gray-400 hover:text-gray-600">
                            <HelpCircle size={18} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Toggle to choose whether to generate an image or a
                          video.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <Textarea
                  required
                  id="prompt"
                  placeholder="e.g., A smart water bottle that tracks hydration and reminds you to drink water"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] border-gray-300 transition-all duration-300 ease-out focus:border-blue-400 focus:ring-blue-400"
                />
                {/* Tone Selection */}
                <div className="space-y-3">
                  <Label className="font-semibold">Content Tone</Label>
                  <div className="flex flex-wrap gap-3">
                    {predefinedTones.map((t) => (
                      <Badge
                        key={t}
                        variant={tone === t ? "default" : "outline"}
                        className={`cursor-pointer rounded-full px-4 py-1.5 text-base transition-all duration-300 ease-out ${
                          tone === t
                            ? "scale-105 bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md hover:from-purple-700 hover:to-blue-700"
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        }`}
                        onClick={() => setTone(t)}
                      >
                        {t}
                      </Badge>
                    ))}
                    <Badge
                      variant={tone === "custom" ? "default" : "outline"}
                      className={`cursor-pointer rounded-full px-4 py-1.5 text-base transition-all duration-300 ease-out ${
                        tone === "custom"
                          ? "scale-105 bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md hover:from-purple-700 hover:to-blue-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
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
                      className="border-gray-300 transition-all duration-300 ease-out focus:border-blue-400 focus:ring-blue-400"
                    />
                  )}
                </div>
                {/* Style Selectors */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="font-semibold">Image Style</Label>
                    <Select value={mediaStyle} onValueChange={setMediaStyle}>
                      <SelectTrigger className="border-gray-300 transition-all duration-300 ease-out focus:border-blue-400 focus:ring-blue-400">
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
                    <Label className="font-semibold">Voice Style</Label>
                    <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                      <SelectTrigger className="border-gray-300 transition-all duration-300 ease-out focus:border-blue-400 focus:ring-blue-400">
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
                    {/* Audio Type Switch */}
                    <div className="mt-2 flex items-center gap-3">
                      <Label className="font-semibold">Audio Type</Label>
                      <Select value={audioType} onValueChange={setAudioType}>
                        <SelectTrigger className="border-gray-300 w-32 transition-all duration-300 ease-out focus:border-blue-400 focus:ring-blue-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="voice">Voice</SelectItem>
                          <SelectItem value="jingle">Jingle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                {/* File Upload */}
                <FileUpload
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                />

                {/* Generate Button */}
                <Button
                  type="submit"
                  disabled={!prompt.trim() || isGenerating}
                  className="w-full rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-lg font-semibold text-white shadow-lg transition-all duration-300 ease-out hover:scale-105 hover:from-purple-700 hover:to-blue-700 hover:shadow-xl"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating Content...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-5 w-5" />
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
            // invalidate={invalidate}
            contentsStatus={{
              mediaStatus,
              audioLoading,
            }}
            originalPrompt={prompt}
            tone={(tone === "custom" ? customTone : tone) as string}
            mediaStyle={mediaStyle}
            voiceStyle={voiceStyle}
            chatId={searchParams.get("chatId")!}
          />
        </div>
      </div>
    </div>
  );
}
