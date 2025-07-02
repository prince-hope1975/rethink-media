"use client";

import { useState } from "react";
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

interface GeneratedContentProps {
  content: {
    headline?: string;
    caption?: string;
    imageUrl?: string;
    audioUrl?: string;
  };
  isGenerating: boolean;
  onContentUpdate: (content: any) => void;
  contentsStatus: {
    imageStatus: "idle" | "pending" | "error" | "timeout";
    audioLoading: "idle" | "pending" | "error" | "timeout";
  };
  originalPrompt: string;
  tone: string;
  imageStyle: string;
  voiceStyle: string;
}

export function GeneratedContent({
  content,
  isGenerating,
  onContentUpdate,
  originalPrompt,
  tone,
  imageStyle,
  voiceStyle,
  contentsStatus,
}: GeneratedContentProps) {
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [regeneratingContent, setRegeneratingContent] = useState<string | null>(
    null,
  );

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
          imageStyle,
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

  if (!hasContent && !isGenerating) {
    return (
      <Card className="h-fit">
        <CardContent className="p-12 text-center">
          <div className="mb-4 text-gray-400">
            <Loader2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Generated Content</span>
          {hasContent && (
            <Badge variant="secondary" className="text-xs">
              {Object.keys(content).length} items generated
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-1">
              <Volume2 className="h-4 w-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            {isGenerating && !content.headline ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>Generating headline and caption...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Headline */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Marketing Headline</h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingContent("headline")}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateContent("headline")}
                        disabled={regeneratingContent === "headline"}
                      >
                        {regeneratingContent === "headline" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(content.headline || "")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-lg font-semibold">{content.headline}</p>
                  </div>
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Marketing Caption</h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingContent("caption")}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateContent("caption")}
                        disabled={regeneratingContent === "caption"}
                      >
                        {regeneratingContent === "caption" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(content.caption || "")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p>{content.caption}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            {isGenerating &&
            !content.imageUrl &&
            contentsStatus.imageStatus !== "timeout" ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>Generating image...</span>
              </div>
            ) : content.imageUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Generated Image</h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateContent("image")}
                      disabled={regeneratingContent === "image"}
                    >
                      {regeneratingContent === "image" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        downloadContent(
                          content.imageUrl!,
                          "generated-image.png",
                        )
                      }
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <img
                    src={content.imageUrl || "/placeholder.svg"}
                    alt="Generated content"
                    className="h-auto w-full"
                  />
                </div>
                <Badge variant="outline" className="text-xs">
                  Style: {imageStyle}
                </Badge>
              </div>
            ) : contentsStatus.imageStatus === "timeout" ? (
              <div className="flex items-center justify-center p-8">
                <span>Image generation timed out. Please try again.</span>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            {isGenerating &&
            !content.audioUrl &&
            contentsStatus.audioLoading !== "timeout" ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>Generating audio...</span>
              </div>
            ) : content.audioUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Generated Audio</h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateContent("audio")}
                      disabled={regeneratingContent === "audio"}
                    >
                      {regeneratingContent === "audio" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        downloadContent(
                          content.audioUrl!,
                          "generated-audio.mp3",
                        )
                      }
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <audio controls className="w-full">
                    <source src={content.audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
                <Badge variant="outline" className="text-xs">
                  Voice: {voiceStyle}
                </Badge>
              </div>
            ) : contentsStatus.audioLoading === "timeout" ? (
              <div className="flex items-center justify-center p-8">
                <span>Audio generation timed out. Please try again.</span>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        {editingContent && (
          <ContentEditor
            type={editingContent}
            currentContent={
              content[editingContent as keyof typeof content] || ""
            }
            onSave={(newContent) => {
              onContentUpdate({
                ...content,
                [editingContent]: newContent,
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
