"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"
import { Label } from "~/components/ui/label"

interface ContentEditorProps {
  type: string
  currentContent: string
  onSave: (content: string) => void
  onCancel: () => void
}

export function ContentEditor({ type, currentContent, onSave, onCancel }: ContentEditorProps) {
  const [content, setContent] = useState(currentContent)

  const handleSave = () => {
    onSave(content)
  }

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 px-6 rounded-t-lg">
          <DialogTitle className="text-white">Edit {type.charAt(0).toUpperCase() + type.slice(1)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="content" className="text-gray-700 font-semibold">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[180px] border-gray-300 focus:border-blue-400 focus:ring-blue-400 transition-all duration-300 ease-out"
              placeholder={`Enter your ${type} content...`}
            />
          </div>
        </div>
        <DialogFooter className="bg-gray-50 px-6 py-4 flex justify-end gap-2 rounded-b-lg">
          <Button variant="outline" onClick={onCancel} className="px-4 py-2 rounded-full border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200">
            Cancel
          </Button>
          <Button onClick={handleSave} className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md hover:from-purple-700 hover:to-blue-700 transition-all duration-300 ease-out">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
