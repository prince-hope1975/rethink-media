"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  FileText,
  ImageIcon,
  Volume2,
  Download,
  Copy,
  Edit,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ContentEditor } from "~/components/content-editor";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import moment from "moment";
import axios from "axios";
import {
  z_generateAudioInterface,
  z_generateContentInterface,
} from "~/ai/validation";
import { useAtom } from "jotai";
import { audioTypeAtom } from "~/ai/jotaiAtoms";
import { useToast } from "~/app/hooks/use-toast";

interface GeneratedContentProps {
  content: {
    headline?: string;
    caption?: string;
    mediaUrl?: string;
    mediaType?: "video" | "image";
    audioUrl?: string;
    headlinePrompt?: string;
    mediaPrompt?: string;
    audioPrompt?: string;
  };
  isGenerating: boolean;
  onContentUpdate: (content: any) => void;
  contentsStatus: {
    mediaStatus: "idle" | "pending" | "error" | "timeout";
    audioLoading: "idle" | "pending" | "error" | "timeout";
  };
  originalPrompt: string;
  tone: string;
  mediaStyle: string;
  voiceStyle: string;
  chatId: string | undefined;
}

// Utility: Animated Loader for different content types
function LoadingSection({
  type,
  message,
  subtext,
}: {
  type: "text" | "media" | "audio";
  message: string;
  subtext?: string;
}) {
  let icon;
  let gradient;
  let animation;
  switch (type) {
    case "media":
      icon = <ImageIcon className="mb-2 h-10 w-10 animate-bounce" />;
      gradient = "from-pink-400 via-purple-400 to-blue-400";
      animation = "animate-pulse";
      break;
    case "audio":
      icon = <Volume2 className="animate-wave mb-2 h-10 w-10" />;
      gradient = "from-blue-400 via-green-400 to-purple-400";
      animation = "animate-pulse";
      break;
    case "text":
    default:
      icon = <FileText className="mb-2 h-10 w-10 animate-bounce" />;
      gradient = "from-purple-400 via-blue-400 to-pink-400";
      animation = "animate-pulse";
      break;
  }
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl bg-gradient-to-br p-10 ${gradient} bg-clip-padding shadow-lg ${animation}`}
      style={{ minHeight: 220 }}
    >
      <div className="flex flex-col items-center justify-center">
        {icon}
        <Loader2 className="mb-2 h-8 w-8 animate-spin text-white" />
      </div>
      <span className="mt-2 text-center text-lg font-semibold text-white drop-shadow-lg">
        {message}
      </span>
      {subtext && (
        <span className="mt-1 text-center text-sm text-white/80">
          {subtext}
        </span>
      )}
    </div>
  );
}

export function GeneratedContent({
  content,
  isGenerating,
  onContentUpdate,
  originalPrompt,
  tone,
  mediaStyle: mediaStyle,
  voiceStyle,
  contentsStatus,
  chatId,
}: GeneratedContentProps) {
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [regeneratingContent, setRegeneratingContent] = useState<string | null>(
    null,
  );
  const [openPromptDialog, setOpenPromptDialog] = useState<null | {
    type: "headline" | "caption" | "media" | "audio" | "image" | "video";
    value: string;
    id: string | number | undefined;
  }>(null);
  console.log({ openPromptDialog });

  const hasContent = Object.keys(content).length > 0;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadContent = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const regenerateContent = async (type: string) => {
    setRegeneratingContent(type);

    try {
      const response = await fetch("/api/regenerate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          originalPrompt,
          tone,
          imageStyle: mediaStyle,
          voiceStyle,
          currentContent: content,
        }),
      });

      const data = await response.json();
      onContentUpdate({ ...content, ...data });
    } catch (error) {
      console.error("Regeneration failed:", error);
    } finally {
      setRegeneratingContent(null);
    }
  };

  const getPromptForType = (type: "headline" | "media" | "audio") => {
    if (type === "headline") return content.headlinePrompt || originalPrompt;
    if (type === "media") return content.mediaPrompt || originalPrompt;
    if (type === "audio") return content.audioPrompt || originalPrompt;
    return originalPrompt;
  };
  const [audioType, setAudioType] = useAtom<"voice" | "jingle">(audioTypeAtom);

  const updatePromptForItem = async (
    type: "headline" | "caption" | "media" | "audio" | "image" | "video",
    id: string | number | undefined,
    value: string,
  ) => {
    const routes = {
      audio: "/api/regenerate-content/audio",
      video: "/api/regenerate-content/media",
      image: "/api/regenerate-content/media",
      media: "/api/regenerate-content/media",
      caption: "/api/regenerate-content/text",
      headline: "/api/regenerate-content/text",
    };
    const data = await axios.post(
      routes[type],
      z_generateContentInterface
        .pick({
          audioType: type == "audio" ? true : undefined,
          mediaType:
            type == "media" || type == "video" || type == "image"
              ? true
              : undefined,
          chatID: true,
          prompt: true,
        })
        .parse({
          prompt: value,
          chatID: +chatId!,
          audioType: type == "audio" ? audioType : undefined,
          mediaType: type,
        }),
    );
    if (type === "headline" || type === "caption") {
      // onContentUpdate({
      //   ...content,
      //   [type + "Prompt"]: value,
      // });
      // await regenerateContent(type);
      return;
    }
    // setR((prev) => ({
    //   ...prev,
    //   headline: contentResponse.result.headline,
    //   caption: contentResponse.result.caption,
    // }));

    console.log("After invalidation");
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await utils.chat.invalidate();
    }
  };

  const latestAudio = api.chat.getLatestAudios.useQuery(
    { chatID: +chatId! },
    {
      enabled: !!chatId,
      refetchInterval: (query) => {
        const opt = query.state.data?.at(0);
        if (opt?.status === "processing" || opt?.status === "pending") {
          return 10_000;
        }
        return false;
      },
    },
  );

  const latestImage = api.chat.getLatestImages.useQuery(
    { chatID: +chatId! },
    {
      enabled: !!chatId,
      refetchInterval: (query) => {
        const opt = query.state.data?.at(0);
        if (opt?.status === "processing" || opt?.status === "pending") {
          return 10_000;
        }
        return false;
      },
    },
  );
  const latestVideo = api.chat.getLatestVideos.useQuery(
    { chatID: +chatId! },
    {
      enabled: !!chatId,
      refetchInterval: (query) => {
        const opt = query.state.data?.at(0);
        if (opt?.status === "processing" || opt?.status === "pending") {
          return 10_000;
        }
        return false;
      },
    },
  );

  const latestText = api.chat.getLatestTexts.useQuery(
    { chatID: +chatId! },
    {
      enabled: !!chatId,
      refetchInterval: (query) => {
        const opt = query.state.data?.at(0);
        if (opt?.status === "processing" || opt?.status === "pending") {
          return 10_000;
        }
        return false;
      },
    },
  );
  const utils = api.useUtils();
  const { toast } = useToast();

  // useEffect(() => {
  //   const latestAudioStatus = latestAudio.data?.at(0)?.status;
  //   const latestVideoStatus = latestVideo.data?.at(0)?.status;
  //   const latestImageStatus = latestImage.data?.at(0)?.status;
  //   const latestText = latestImage.data?.at(0)?.status;
  //   if (latestAudioStatus == "processing" || latestAudioStatus == "pending") {
  //   }
  // }, []);

  // console.log({
  //   latestAudio: latestAudio.data,
  //   latestImage: latestImage.data,
  //   latestVideo: latestVideo.data,
  //   latestText: latestText.data,
  // });

  // useEffect(() => {
  //   if (!chatId) return;
  //   // Prefer video if newer, else image
  //   let media = latestImage.data;
  //   if (
  //     latestVideo.data &&
  //     (!latestImage.data ||
  //       new Date(latestVideo.data.updatedAt) > new Date(latestImage.data.updatedAt))
  //   ) {
  //     media = latestVideo.data;
  //   }
  //   const textContent = latestText.data?.content_or_url
  //     ? (() => {
  //         try {
  //           return JSON.parse(latestText.data.content_or_url);
  //         } catch {
  //           return undefined;
  //         }
  //       })()
  //     : undefined;
  //   onContentUpdate({
  //     ...content,
  //     audioUrl: latestAudio.data?.content_or_url ?? content.audioUrl,
  //     audioPrompt: latestAudio.data?.prompt ?? content.audioPrompt,
  //     mediaUrl: media?.content_or_url ?? content.mediaUrl,
  //     mediaType: media?.type ?? content.mediaType,
  //     mediaPrompt: media?.prompt ?? content.mediaPrompt,
  //     headline: textContent?.headline ?? content.headline,
  //     caption: textContent?.caption ?? content.caption,
  //   });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [chatId, latestAudio.data, latestImage.data, latestVideo.data, latestText.data]);

  if (!hasContent && !isGenerating) {
    return (
      <Card className="animate-in fade-in slide-in-from-bottom-4 h-fit duration-1000">
        <CardContent className="p-12 text-center">
          <div className="mb-4 text-gray-400">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-pulse opacity-50" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-600">
            Ready to Generate
          </h3>
          <p className="text-gray-500">
            Enter your prompt and click generate to create amazing content
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 h-fit overflow-hidden rounded-xl shadow-xl duration-1000 w-full">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 px-4 sm:px-6 py-3 sm:py-4 text-white">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-white gap-2 text-lg sm:text-xl">
          <span>Generated Content</span>
          {hasContent && (
            <Badge
              variant="secondary"
              className="bg-white text-xs text-blue-600"
            >
              {Object.keys(content).length} items generated
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-3 rounded-lg bg-gray-100 p-1 text-xs sm:text-sm">
            <TabsTrigger
              value="text"
              className="flex items-center gap-1 rounded-md transition-all duration-300 ease-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <FileText className="h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger
              value="media"
              className="flex items-center gap-1 rounded-md transition-all duration-300 ease-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <ImageIcon className="h-4 w-4" />
              {content?.mediaType ?? "image"}
            </TabsTrigger>
            <TabsTrigger
              value="audio"
              className="flex items-center gap-1 rounded-md transition-all duration-300 ease-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Volume2 className="h-4 w-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div className="mb-2 flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
              <Dialog
                open={!!openPromptDialog}
                onOpenChange={(open) => !open && setOpenPromptDialog(null)}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Edit{" "}
                      {openPromptDialog?.type
                        ? openPromptDialog.type.charAt(0).toUpperCase() +
                          openPromptDialog.type.slice(1)
                        : ""}{" "}
                      Prompt
                    </DialogTitle>
                  </DialogHeader>
                  <Textarea
                    value={openPromptDialog?.value || ""}
                    onChange={(e) =>
                      setOpenPromptDialog(
                        openPromptDialog
                          ? { ...openPromptDialog, value: e.target.value }
                          : null,
                      )
                    }
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setOpenPromptDialog(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (openPromptDialog) {
                          try {
                            await updatePromptForItem(
                              openPromptDialog.type,
                              openPromptDialog.id ?? undefined,
                              openPromptDialog.value,
                            );
                            setOpenPromptDialog(null);
                          } catch (err) {
                            toast({
                              title: "Error updating prompt",
                              description: err instanceof Error ? err.message : "An error occurred while updating the prompt.",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {(isGenerating || latestText.isLoading || latestText.isFetching) &&
            !latestText?.data?.length ? (
              <LoadingSection
                type="text"
                message="Generating captivating copy..."
                subtext="Crafting the perfect headline and caption for your brand."
              />
            ) : (
              <div className="space-y-4">
                {latestText?.data?.map((data, idx) => {
                  if (
                    data?.status === "processing" ||
                    data?.status === "pending"
                  ) {
                    return (
                      <LoadingSection
                        key={data.id || idx}
                        type="text"
                        message="Generating captivating copy..."
                        subtext="Crafting the perfect headline and caption for your brand."
                      />
                    );
                  }
                  if (data?.status === "failed") {
                    return (
                      <div
                        key={data.id || idx}
                        className="flex flex-col items-center justify-center p-8 text-red-500"
                      >
                        <p className="text-lg font-medium">
                          Text generation failed. Please try again.
                        </p>
                      </div>
                    );
                  }
                  let textContent: { headline?: string; caption?: string } = {};
                  try {
                    textContent = data?.content_or_url
                      ? JSON.parse(data.content_or_url)
                      : {};
                  } catch {}
                  const time = data?.updatedAt || data?.createdAt;
                  return (
                    <div
                      key={data.id || idx}
                      className="space-y-2 rounded border border-white p-1"
                    >
                      {/* Headline */}
                      <div className="space-y-2 rounded-lg border-b border-gray-200/50 p-4 shadow-sm transition-shadow duration-300 ease-out hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Marketing Headline</h4>
                          <div className="flex items-center gap-1">
                            {time && (
                              <span className="mr-2 text-xs text-gray-400">
                                {moment(time).fromNow()}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setOpenPromptDialog({
                                  type: "headline",
                                  value: data?.prompt || originalPrompt,
                                  id: data?.id ?? undefined,
                                })
                              }
                              className="text-gray-500 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => regenerateContent("headline")}
                              disabled={regeneratingContent === "headline"}
                              className="text-gray-500 transition-colors duration-200 hover:bg-green-50 hover:text-green-600"
                            >
                              {regeneratingContent === "headline" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(textContent.headline || "")
                              }
                              className="text-gray-500 transition-colors duration-200 hover:bg-purple-50 hover:text-purple-600"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-xl font-bold">
                            {textContent.headline}
                          </p>
                        </div>
                      </div>
                      {/* Caption */}
                      <div className="space-y-2 rounded-lg border-b border-gray-200/50 p-4 shadow-sm transition-shadow duration-300 ease-out hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Marketing Caption</h4>
                          <div className="flex items-center gap-1">
                            {time && (
                              <span className="mr-2 text-xs text-gray-400">
                                {moment(time).fromNow()}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setOpenPromptDialog({
                                  type: "caption",
                                  value: data?.prompt || originalPrompt,
                                  id: data?.id ?? undefined,
                                })
                              }
                              className="text-gray-500 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => regenerateContent("caption")}
                              disabled={regeneratingContent === "caption"}
                              className="text-gray-500 transition-colors duration-200 hover:bg-green-50 hover:text-green-600"
                            >
                              {regeneratingContent === "caption" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(textContent.caption || "")
                              }
                              className="text-gray-500 transition-colors duration-200 hover:bg-purple-50 hover:text-purple-600"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="leading-relaxed">
                            {textContent.caption}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <div className="mb-2 flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
              <Dialog
                open={
                  !!openPromptDialog &&
                  (openPromptDialog.type === "video" ||
                    openPromptDialog.type === "image")
                }
                onOpenChange={(open) => !open && setOpenPromptDialog(null)}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Edit{" "}
                      {openPromptDialog?.type
                        ? openPromptDialog.type.charAt(0).toUpperCase() +
                          openPromptDialog.type.slice(1)
                        : ""}{" "}
                      Prompt
                    </DialogTitle>
                  </DialogHeader>
                  <Textarea
                    value={openPromptDialog?.value || ""}
                    onChange={(e) =>
                      setOpenPromptDialog(
                        openPromptDialog
                          ? { ...openPromptDialog, value: e.target.value }
                          : null,
                      )
                    }
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setOpenPromptDialog(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (openPromptDialog) {
                          try {
                            await updatePromptForItem(
                              openPromptDialog.type,
                              openPromptDialog.id ?? undefined,
                              openPromptDialog.value,
                            );
                            setOpenPromptDialog(null);
                          } catch (err) {
                            toast({
                              title: "Error updating prompt",
                              description: err instanceof Error ? err.message : "An error occurred while updating the prompt.",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {(() => {
              const mediaData = [
                ...(latestImage?.data ?? []),
                ...(latestVideo?.data ?? []),
              ];
              mediaData.sort((a, b) => {
                const aTime = new Date(
                  a.updatedAt || a.createdAt || 0,
                ).getTime();
                const bTime = new Date(
                  b.updatedAt || b.createdAt || 0,
                ).getTime();
                return bTime - aTime;
              });
              if (
                (isGenerating ||
                  latestImage.isLoading ||
                  latestImage.isFetching ||
                  latestVideo.isLoading ||
                  latestVideo.isFetching) &&
                !mediaData.length &&
                contentsStatus.mediaStatus !== "timeout"
              ) {
                return (
                  <LoadingSection
                    type="media"
                    message="Crafting your visual masterpiece..."
                    subtext={`Generating a stunning ${content?.mediaType ?? "image"} to match your prompt.`}
                  />
                );
              }
              if (contentsStatus.mediaStatus === "timeout") {
                return (
                  <div className="flex flex-col items-center justify-center p-8 text-red-500">
                    <p className="text-lg font-medium">
                      Image generation timed out. Please try again.
                    </p>
                    <Button>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                );
              }
              return mediaData.map((data, idx) => {
                if (
                  data?.status === "processing" ||
                  data?.status === "pending"
                ) {
                  return (
                    <LoadingSection
                      key={data.id || idx}
                      type="media"
                      message="Crafting your visual masterpiece..."
                      subtext="Generating a stunning {data?.type === 'video' ? 'video' : 'image'} to match your prompt."
                    />
                  );
                }
                if (data?.status === "failed") {
                  return (
                    <div
                      key={data.id || idx}
                      className="flex flex-col items-center justify-center p-8 text-red-500"
                    >
                      <p className="text-lg font-medium">
                        Media generation failed. Please try again.
                      </p>
                    </div>
                  );
                }
                const time = data?.updatedAt || data?.createdAt;
                return (
                  <div
                    key={data.id || idx}
                    className={`space-y-4 rounded-lg border border-gray-200 p-4 shadow-sm transition-shadow duration-300 ease-out hover:shadow-md`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-xl font-semibold text-transparent">
                        {idx == 0 ? "New Generated" : ""} {data?.type === "video" ? "Video" : "Image"}
                      </h4>
                      <div className="flex items-center gap-1">
                        {time && (
                          <span className="mr-2 text-xs text-gray-400">
                            {moment(time).fromNow()}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setOpenPromptDialog({
                              type: data.type === "video" ? "video" : "image",
                              value: data.prompt || getPromptForType("media"),
                              id: data.id ?? undefined,
                            })
                          }
                          className="text-gray-500 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            downloadContent(
                              data.content_or_url || "",
                              data?.type === "video"
                                ? "generated-video.mp4"
                                : "generated-image.png",
                            )
                          }
                          className="text-gray-500 transition-colors duration-200 hover:bg-purple-50 hover:text-purple-600"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 h-auto w-full overflow-hidden rounded-lg border border-gray-200">
                      {data?.type === "video" ? (
                        <video
                          src={data.content_or_url}
                          className="h-auto w-full object-cover"
                          controls
                        />
                      ) : (
                        <img
                          src={data.content_or_url}
                          alt="Generated Image"
                          className="h-auto w-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            <div className="mb-2 flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
              <Dialog
                open={!!openPromptDialog && openPromptDialog.type === "audio"}
                onOpenChange={(open) => !open && setOpenPromptDialog(null)}
              >
                <DialogTrigger asChild></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Audio Prompt</DialogTitle>
                  </DialogHeader>
                  <Textarea
                    value={openPromptDialog?.value || ""}
                    onChange={(e) =>
                      setOpenPromptDialog(
                        openPromptDialog
                          ? { ...openPromptDialog, value: e.target.value }
                          : null,
                      )
                    }
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setOpenPromptDialog(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (openPromptDialog) {
                          try {
                            await updatePromptForItem(
                              "audio",
                              chatId,
                              openPromptDialog.value,
                            );
                            setOpenPromptDialog(null);
                          } catch (err) {
                            toast({
                              title: "Error updating prompt",
                              description: err instanceof Error ? err.message : "An error occurred while updating the prompt.",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {(isGenerating ||
              latestAudio.isLoading ||
              latestAudio.isFetching) &&
            !latestAudio?.data?.length &&
            contentsStatus.audioLoading !== "timeout" ? (
              <LoadingSection
                type="audio"
                message="Synthesizing natural voice..."
                subtext="Creating a lifelike audio narration for your content."
              />
            ) : (
              latestAudio?.data?.map((data, idx) => {
                if (data?.status == "processing" || data?.status == "pending") {
                  return (
                    <LoadingSection
                      key={data.id || idx}
                      type="audio"
                      message="Synthesizing natural voice..."
                      subtext="Creating a lifelike audio narration for your content."
                    />
                  );
                }
                if (data?.status == "failed") {
                  return (
                    <div className="flex flex-col items-center justify-center p-8 text-red-500">
                      <p className="text-lg font-medium">
                        Audio generation failed out. Please try again.
                      </p>
                    </div>
                  );
                }
                const time = data?.updatedAt || data?.createdAt;
                return (
                  <div className="space-y-4 rounded-lg border border-gray-200 p-4 shadow-sm transition-shadow duration-300 ease-out hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Generated Audio</h4>
                      <div className="flex items-center gap-1">
                        {time && (
                          <span className="mr-2 text-xs text-gray-400">
                            {moment(time).fromNow()}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setOpenPromptDialog({
                              type: "audio",
                              value: data?.prompt || getPromptForType("audio"),
                              id: data?.id ?? undefined,
                            })
                          }
                          className="text-gray-500 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            downloadContent(
                              data?.content_or_url || "",
                              "generated-audio.wav",
                            )
                          }
                          className="text-gray-500 transition-colors duration-200 hover:bg-purple-50 hover:text-purple-600"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 w-full">
                      <audio
                        controls
                        src={data?.content_or_url}
                        className="w-full rounded-md"
                      ></audio>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {editingContent && (
          <ContentEditor
            type={editingContent}
            currentContent={
              editingContent === "headline"
                ? content.headline || ""
                : content.caption || ""
            }
            onSave={(updatedContent) => {
              onContentUpdate({
                ...content,
                [editingContent]: updatedContent,
              });
              setEditingContent(null);
            }}
            onCancel={() => setEditingContent(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
