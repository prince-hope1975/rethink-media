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
        <DialogHeader>
          <DialogTitle>Edit {type.charAt(0).toUpperCase() + type.slice(1)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[150px]"
              placeholder={`Enter your ${type} content...`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
