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
      <label className="text-lg font-semibold ">Reference Files (Optional)</label>

      <Card
        className={`border-2 border-dashed rounded-lg transition-all duration-300 ease-out p-6 text-center shadow-sm ${dragActive ? "border-blue-500 bg-blue-50 ring-4 ring-blue-200" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="p-0">
          <Upload className="mx-auto h-10 w-10 text-blue-400 mb-2 animate-bounce-slow" />
          <p className="text-base text-gray-700 mb-1 font-medium">Drag & drop your files here, or <span className="text-blue-500 font-semibold cursor-pointer">click to browse</span></p>
          <p className="text-sm text-gray-500">Supported: Images, PDFs. Max 10MB per file.</p>
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
        <div className="flex flex-wrap gap-3 mt-4 animate-in fade-in slide-in-from-top-2">
          {files.map((file, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-2 pr-2 py-2 text-base rounded-full bg-blue-100 text-blue-800 shadow-sm">
              {file.type.startsWith("image/") ? <ImageIcon className="h-4 w-4 text-blue-600" /> : <FileText className="h-4 w-4 text-blue-600" />}
              <span className="text-sm font-medium truncate max-w-[120px]">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-blue-600 hover:bg-blue-200 hover:text-red-600 rounded-full transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
