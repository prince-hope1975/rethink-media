"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Upload, X, FileText, ImageIcon } from "lucide-react"

interface FileUploadProps {
  files: File[]
  onFilesChange: (files: File[]) => void
}

export function FileUpload({ files, onFilesChange }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return

    const validFiles = Array.from(newFiles).filter((file) => {
      const isImage = file.type.startsWith("image/")
      const isPDF = file.type === "application/pdf"
      const isValidSize = file.size <= 10 * 1024 * 1024 // 10MB

      return (isImage || isPDF) && isValidSize
    })

    onFilesChange([...files, ...validFiles])
  }

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Reference Files (Optional)</label>

      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="p-6 text-center">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-1">Drop images or PDFs here, or click to browse</p>
          <p className="text-xs text-gray-400">Max 10MB per file</p>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
              {file.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
              <span className="text-xs truncate max-w-[100px]">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
