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
import { util } from "zod";
import moment from "moment";

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
    type: "headline" | "media" | "audio";
    value: string;
  }>(null);

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

  const updatePromptForType = (
    type: "headline" | "media" | "audio",
    value: string,
  ) => {
    if (type === "headline") {
      onContentUpdate({ ...content, headlinePrompt: value });
    } else if (type === "media") {
      onContentUpdate({ ...content, mediaPrompt: value });
    } else if (type === "audio") {
      onContentUpdate({ ...content, audioPrompt: value });
    }
  };

  const latestAudio = api.chat.getLatestAudios.useQuery(
    { chatID: +chatId! },
    { enabled: !!chatId },
  );
  console.log({
    loading: latestAudio.isLoading,
    fetching: latestAudio.isFetching,
  });
  const latestImage = api.chat.getLatestImages.useQuery(
    { chatID: +chatId! },
    { enabled: !!chatId },
  );
  const latestVideo = api.chat.getLatestVideos.useQuery(
    { chatID: +chatId! },
    { enabled: !!chatId },
  );
  const latestText = api.chat.getLatestTexts.useQuery(
    { chatID: +chatId! },
    { enabled: !!chatId },
  );
  // const utils = api.useUtils();

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
    <Card className="animate-in fade-in slide-in-from-bottom-4 h-fit overflow-hidden rounded-xl shadow-xl duration-1000">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-4 text-white">
        <CardTitle className="flex items-center justify-between text-white">
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
      <CardContent className="p-6">
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-3 rounded-lg bg-gray-100 p-1">
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
            <div className="mb-2 flex items-center justify-end">
              <Dialog
                open={
                  !!openPromptDialog && openPromptDialog.type === "headline"
                }
                onOpenChange={(open) => !open && setOpenPromptDialog(null)}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOpenPromptDialog({
                        type: "headline",
                        value: getPromptForType("headline"),
                      })
                    }
                    className="text-xs"
                  >
                    <Edit className="mr-1 h-4 w-4" /> Edit Headline Prompt
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Headline Prompt</DialogTitle>
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
                      onClick={() => {
                        if (openPromptDialog)
                          updatePromptForType(
                            "headline",
                            openPromptDialog.value,
                          );
                        setOpenPromptDialog(null);
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {isGenerating && !latestText?.data?.length ? (
              <div className="flex flex-col items-center justify-center p-8 text-blue-500">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <span className="mt-2 text-lg font-medium">
                  Generating captivating copy...
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {latestText?.data?.map((data, idx) => {
                  if (
                    data?.status === "processing" ||
                    data?.status === "pending"
                  ) {
                    return (
                      <div
                        key={data.id || idx}
                        className="flex flex-col items-center justify-center p-8 text-blue-500"
                      >
                        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                        <span className="mt-2 text-lg font-medium">
                          Generating captivating copy...
                        </span>
                      </div>
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
                      {idx == 0 && (
                        <h3 className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text px-4 text-xl font-bold text-transparent">
                          Latest Generated Content
                        </h3>
                      )}
                      {/* Headline */}
                      <div className="space-y-2 rounded-lg border-b border-gray-200/50 p-4 shadow-sm transition-shadow duration-300 ease-out hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Marketing Headline</h4>
                          <div className="flex gap-1 items-center">
                            {time && (
                              <span className="text-xs text-gray-400 mr-2">
                                {moment(time).fromNow()}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingContent("headline")}
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
                          <div className="flex gap-1 items-center">
                            {time && (
                              <span className="text-xs text-gray-400 mr-2">
                                {moment(time).fromNow()}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingContent("caption")}
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
            <div className="mb-2 flex items-center justify-end">
              <Dialog
                open={!!openPromptDialog && openPromptDialog.type === "media"}
                onOpenChange={(open) => !open && setOpenPromptDialog(null)}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOpenPromptDialog({
                        type: "media",
                        value: getPromptForType("media"),
                      })
                    }
                    className="text-xs"
                  >
                    <Edit className="mr-1 h-4 w-4" /> Edit Media Prompt
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Media Prompt</DialogTitle>
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
                      onClick={() => {
                        if (openPromptDialog)
                          updatePromptForType("media", openPromptDialog.value);
                        setOpenPromptDialog(null);
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Default loader */}
            {latestImage.isFetching ||
              (latestImage.isLoading || latestVideo.isFetching,
              latestVideo.isLoading && (
                <div className="flex flex-col items-center justify-center p-8 text-blue-500">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                  <span className="mt-2 text-lg font-medium">
                    Crafting your visual masterpiece...
                  </span>
                </div>
              ))}

            {(() => {
              const mediaData = [
                ...(latestImage?.data ?? []),
                ...(latestVideo?.data ?? []),
              ];
              // Sort by updatedAt or index (descending)
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
                isGenerating &&
                !mediaData.length &&
                contentsStatus.mediaStatus !== "timeout"
              ) {
                return (
                  <div className="flex flex-col items-center justify-center p-8 text-blue-500">
                    <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                    <span className="mt-2 text-lg font-medium">
                      Crafting your visual masterpiece...
                    </span>
                  </div>
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
                    <div
                      key={data.id || idx}
                      className="flex flex-col items-center justify-center p-8 text-blue-500"
                    >
                      <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                      <span className="mt-2 text-lg font-medium">
                        Crafting your visual masterpiece...
                      </span>
                    </div>
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
                        {idx == 0 ? "New Generated" : ""}{" "}
                        {data?.type === "video" ? "Video" : "Image"}
                      </h4>
                      <div className="flex gap-1 items-center">
                        {time && (
                          <span className="text-xs text-gray-400 mr-2">
                            {moment(time).fromNow()}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            regenerateContent(data?.type || "image")
                          }
                          disabled={regeneratingContent === data?.type}
                          className="text-gray-500 transition-colors duration-200 hover:bg-green-50 hover:text-green-600"
                        >
                          {regeneratingContent === data?.type ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
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
            <div className="mb-2 flex items-center justify-end">
              <Dialog
                open={!!openPromptDialog && openPromptDialog.type === "audio"}
                onOpenChange={(open) => !open && setOpenPromptDialog(null)}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOpenPromptDialog({
                        type: "audio",
                        value: getPromptForType("audio"),
                      })
                    }
                    className="text-xs"
                  >
                    <Edit className="mr-1 h-4 w-4" /> Edit Audio Prompt
                  </Button>
                </DialogTrigger>
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
                      onClick={() => {
                        if (openPromptDialog)
                          updatePromptForType("audio", openPromptDialog.value);
                        setOpenPromptDialog(null);
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Default loader */}
            {latestAudio.isFetching ||
              (latestAudio.isLoading && (
                <div className="flex flex-col items-center justify-center p-8 text-blue-500">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                  <span className="mt-2 text-lg font-medium">
                    Synthesizing natural voice...
                  </span>
                </div>
              ))}
            {latestAudio?.data?.map((data) => {
              if (data?.status == "processing" || data?.status == "pending") {
                return (
                  <div className="flex flex-col items-center justify-center p-8 text-blue-500">
                    <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                    <span className="mt-2 text-lg font-medium">
                      Synthesizing natural voice...
                    </span>
                  </div>
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
                    <div className="flex gap-1 items-center">
                      {time && (
                        <span className="text-xs text-gray-400 mr-2">
                          {moment(time).fromNow()}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateContent("audio")}
                        disabled={regeneratingContent === "audio"}
                        className="text-gray-500 transition-colors duration-200 hover:bg-green-50 hover:text-green-600"
                      >
                        {regeneratingContent === "audio" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
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
            })}
            {/* {isGenerating &&
            !content.audioUrl &&
            contentsStatus.audioLoading !== "timeout" ? (
              <div className="flex flex-col items-center justify-center p-8 text-blue-500">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <span className="mt-2 text-lg font-medium">
                  Synthesizing natural voice...
                </span>
              </div>
            ) : content.audioUrl ? (
              <div className="space-y-4 rounded-lg border border-gray-200 p-4 shadow-sm transition-shadow duration-300 ease-out hover:shadow-md">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Generated Audio</h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateContent("audio")}
                      disabled={regeneratingContent === "audio"}
                      className="text-gray-500 transition-colors duration-200 hover:bg-green-50 hover:text-green-600"
                    >
                      {regeneratingContent === "audio" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        downloadContent(
                          content.audioUrl || "",
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
                    src={content.audioUrl}
                    className="w-full rounded-md"
                  ></audio>
                </div>
              </div>
            ) : contentsStatus.audioLoading === "timeout" ? (
              <div className="flex flex-col items-center justify-center p-8 text-red-500">
                <p className="text-lg font-medium">
                  Audio generation timed out. Please try again.
                </p>
              </div>
            ) : null} */}
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
