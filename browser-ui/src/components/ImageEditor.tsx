/**
 * ImageEditor - Edit uploaded images with pan, zoom, and rotation
 *
 * Features:
 * - Pan (move image)
 * - Zoom (scale image)
 * - Rotate (turn image)
 * - All controlled via sliders
 * - Export as data URL
 */

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@refinio/lama.ui'
import { Button } from '@refinio/lama.ui'
import { Label } from '@refinio/lama.ui'
import { RotateCw, Move, ZoomIn } from 'lucide-react'

interface ImageEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  onSave: (editedImageDataUrl: string) => void
}

interface Transform {
  zoom: number      // 0.5 to 3.0
  panX: number      // -100 to 100
  panY: number      // -100 to 100
  rotation: number  // 0 to 360 degrees
}

export function ImageEditor({
  open,
  onOpenChange,
  imageUrl,
  onSave
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [transform, setTransform] = useState<Transform>({
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  })
  const [imageLoaded, setImageLoaded] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  // Load image when dialog opens
  useEffect(() => {
    if (open && imageUrl) {
      const img = new Image()
      img.onload = () => {
        imageRef.current = img
        setImageLoaded(true)
        renderCanvas()
      }
      img.src = imageUrl
    } else {
      setImageLoaded(false)
      imageRef.current = null
    }
  }, [open, imageUrl])

  // Re-render canvas when transform changes
  useEffect(() => {
    if (imageLoaded) {
      renderCanvas()
    }
  }, [transform, imageLoaded])

  const renderCanvas = () => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const size = 400
    canvas.width = size
    canvas.height = size

    // Clear canvas
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, size, size)

    // Save context state
    ctx.save()

    // Move to center
    ctx.translate(size / 2, size / 2)

    // Apply rotation
    ctx.rotate((transform.rotation * Math.PI) / 180)

    // Apply pan
    ctx.translate(transform.panX, transform.panY)

    // Apply zoom
    const scale = transform.zoom
    ctx.scale(scale, scale)

    // Draw image centered
    const imgWidth = img.width
    const imgHeight = img.height
    const aspectRatio = imgWidth / imgHeight

    let drawWidth = size * 0.8
    let drawHeight = size * 0.8

    if (aspectRatio > 1) {
      drawHeight = drawWidth / aspectRatio
    } else {
      drawWidth = drawHeight * aspectRatio
    }

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)

    // Restore context state
    ctx.restore()
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Export canvas as data URL
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
    onOpenChange(false)
  }

  const handleReset = () => {
    setTransform({
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
          <DialogDescription>
            Adjust your image with pan, zoom, and rotation controls
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Canvas Preview */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border border-border rounded-lg shadow-sm"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>

          {/* Zoom Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
                <Label>Zoom</Label>
              </div>
              <span className="text-sm text-muted-foreground">{transform.zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              value={transform.zoom}
              onChange={(e) => setTransform({ ...transform, zoom: parseFloat(e.target.value) })}
              min={0.5}
              max={3}
              step={0.1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Pan X Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Move className="h-4 w-4 text-muted-foreground" />
                <Label>Pan Horizontal</Label>
              </div>
              <span className="text-sm text-muted-foreground">{transform.panX.toFixed(0)}px</span>
            </div>
            <input
              type="range"
              value={transform.panX}
              onChange={(e) => setTransform({ ...transform, panX: parseFloat(e.target.value) })}
              min={-100}
              max={100}
              step={1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Pan Y Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Move className="h-4 w-4 text-muted-foreground" />
                <Label>Pan Vertical</Label>
              </div>
              <span className="text-sm text-muted-foreground">{transform.panY.toFixed(0)}px</span>
            </div>
            <input
              type="range"
              value={transform.panY}
              onChange={(e) => setTransform({ ...transform, panY: parseFloat(e.target.value) })}
              min={-100}
              max={100}
              step={1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Rotation Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RotateCw className="h-4 w-4 text-muted-foreground" />
                <Label>Rotation</Label>
              </div>
              <span className="text-sm text-muted-foreground">{transform.rotation.toFixed(0)}°</span>
            </div>
            <input
              type="range"
              value={transform.rotation}
              onChange={(e) => setTransform({ ...transform, rotation: parseFloat(e.target.value) })}
              min={0}
              max={360}
              step={1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!imageLoaded}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
