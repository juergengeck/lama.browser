/**
 * LamaAvatarComposer - Customizable lama avatar builder
 *
 * Allows users to compose custom avatars from layered SVG parts:
 * - Base: outline (always visible)
 * - Fur: fell (fur pattern/color)
 * - Eyes: augen (eye style)
 * - Ears: ohren (ear style)
 * - Accessories: hut (hat), punk (mohawk), krawatte (tie)
 * - Body: hufen (hooves), schwanz (tail)
 */

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@lama/ui'
import { Button } from '@lama/ui'
import { Label } from '@lama/ui'
import { Shuffle, Download } from 'lucide-react'

// Avatar part layers (order matters for rendering)
export const AVATAR_PARTS = {
  outline: '/avatar/outline.svg',      // Base layer (always on)
  fell: '/avatar/fell.svg',            // Fur layer
  hufen: '/avatar/hufen.svg',          // Hooves
  schwanz: '/avatar/schwanz.svg',      // Tail
  ohren: '/avatar/ohren.svg',          // Ears
  augen: '/avatar/augen.svg',          // Eyes
  krawatte: '/avatar/krawatte.svg',    // Tie (accessory)
  hut: '/avatar/hut.svg',              // Hat (accessory)
  punk: '/avatar/punk.svg',            // Punk mohawk (accessory)
} as const

export type AvatarPartKey = keyof typeof AVATAR_PARTS

export interface AvatarConfig {
  fell: boolean
  hufen: boolean
  schwanz: boolean
  ohren: boolean
  augen: boolean
  krawatte: boolean
  hut: boolean
  punk: boolean
  // Selected layers for color overlay
  colorTargets?: Set<AvatarPartKey>
  overlayColor?: string
}

interface LamaAvatarComposerProps {
  config: AvatarConfig
  onChange: (config: AvatarConfig) => void
  onExport?: (dataUrl: string) => void
  size?: number
  showControls?: boolean
  className?: string
}

export function LamaAvatarComposer({
  config,
  onChange,
  onExport,
  size = 200,
  showControls = true,
  className = ''
}: LamaAvatarComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Map<AvatarPartKey, HTMLImageElement>>(new Map())

  // Preload all SVG images
  useEffect(() => {
    const loadImages = async () => {
      const imageMap = new Map<AvatarPartKey, HTMLImageElement>()

      for (const [key, path] of Object.entries(AVATAR_PARTS)) {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            imageMap.set(key as AvatarPartKey, img)
            resolve()
          }
          img.onerror = reject
          img.src = path
        }).catch(err => {
          console.warn(`[LamaAvatarComposer] Failed to load ${key}:`, err)
        })
      }

      setLoadedImages(imageMap)
    }

    loadImages()
  }, [])

  // Render avatar on canvas when config changes
  useEffect(() => {
    if (!canvasRef.current || loadedImages.size === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, size, size)

    // Render layers in order
    const layersToRender: AvatarPartKey[] = ['outline'] // Always render base

    // Add enabled parts
    if (config.fell) layersToRender.push('fell')
    if (config.hufen) layersToRender.push('hufen')
    if (config.schwanz) layersToRender.push('schwanz')
    if (config.ohren) layersToRender.push('ohren')
    if (config.augen) layersToRender.push('augen')
    if (config.krawatte) layersToRender.push('krawatte')
    if (config.hut) layersToRender.push('hut')
    if (config.punk) layersToRender.push('punk')

    // Draw each layer with color overlay if selected
    layersToRender.forEach((key) => {
      const img = loadedImages.get(key)
      if (img) {
        const shouldColor = config.colorTargets?.has(key) && config.overlayColor

        if (shouldColor) {
          // Create temporary canvas for this layer
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = size
          tempCanvas.height = size
          const tempCtx = tempCanvas.getContext('2d')

          if (tempCtx) {
            // Draw layer image
            tempCtx.drawImage(img, 0, 0, size, size)

            // Apply color overlay using source-atop
            tempCtx.globalCompositeOperation = 'source-atop'
            tempCtx.fillStyle = config.overlayColor!
            tempCtx.fillRect(0, 0, size, size)

            // Draw the colored layer to main canvas
            ctx.drawImage(tempCanvas, 0, 0, size, size)
          }
        } else {
          // No color overlay, draw directly
          ctx.drawImage(img, 0, 0, size, size)
        }
      }
    })
  }, [config, loadedImages, size])

  const handleTogglePart = (key: AvatarPartKey) => {
    if (key === 'outline') return // Can't disable base layer
    onChange({ ...config, [key]: !config[key] })
  }

  const handleRandomize = () => {
    const randomConfig: AvatarConfig = {
      fell: Math.random() > 0.3,
      hufen: Math.random() > 0.5,
      schwanz: Math.random() > 0.5,
      ohren: Math.random() > 0.3,
      augen: Math.random() > 0.2,
      krawatte: Math.random() > 0.7,
      hut: Math.random() > 0.7,
      punk: Math.random() > 0.8,
    }
    onChange(randomConfig)
  }

  // Convert hue (0-360) to hex color
  const hueToHex = (hue: number): string => {
    const h = hue / 60
    const c = 1
    const x = c * (1 - Math.abs(h % 2 - 1))
    let r = 0, g = 0, b = 0

    if (h >= 0 && h < 1) { r = c; g = x; b = 0 }
    else if (h >= 1 && h < 2) { r = x; g = c; b = 0 }
    else if (h >= 2 && h < 3) { r = 0; g = c; b = x }
    else if (h >= 3 && h < 4) { r = 0; g = x; b = c }
    else if (h >= 4 && h < 5) { r = x; g = 0; b = c }
    else if (h >= 5 && h < 6) { r = c; g = 0; b = x }

    const toHex = (val: number) => Math.round(val * 255).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  // Convert hex color to hue (0-360)
  const hexToHue = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    if (delta === 0) return 0

    let hue = 0
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4

    hue = Math.round(hue * 60)
    if (hue < 0) hue += 360

    return hue
  }

  const handleExport = () => {
    if (!canvasRef.current) {
      console.warn('[LamaAvatarComposer] Canvas ref is null, cannot export')
      return
    }

    setLoading(true)
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      console.log('[LamaAvatarComposer] Exported avatar, dataUrl length:', dataUrl.length)
      if (onExport) {
        onExport(dataUrl)
      }
    } finally {
      setLoading(false)
    }
  }

  const partLabels: Record<AvatarPartKey, string> = {
    outline: 'Base',
    fell: 'Fur',
    hufen: 'Hooves',
    schwanz: 'Tail',
    ohren: 'Ears',
    augen: 'Eyes',
    krawatte: 'Tie',
    hut: 'Hat',
    punk: 'Mohawk',
  }

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Avatar Preview */}
      <Card className="p-4">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="border border-border rounded-lg"
          style={{ width: size, height: size }}
        />
      </Card>

      {showControls && (
        <>
          {/* Part Toggles */}
          <Card className="w-full">
            <CardContent className="pt-6">
              <Label className="text-sm font-medium mb-3 block">Avatar Parts</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(AVATAR_PARTS) as AvatarPartKey[]).map(key => {
                  if (key === 'outline') return null // Skip base layer

                  const isEnabled = config[key]
                  const isColorTarget = config.colorTargets?.has(key) ?? false

                  return (
                    <div key={key} className="relative">
                      <Button
                        variant={isEnabled ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleTogglePart(key)}
                        className="w-full flex items-center justify-center"
                      >
                        {partLabels[key]}
                      </Button>
                      {isEnabled && (
                        <input
                          type="checkbox"
                          checked={isColorTarget}
                          onChange={(e) => {
                            const newTargets = new Set(config.colorTargets || [])
                            if (e.target.checked) {
                              newTargets.add(key)
                            } else {
                              newTargets.delete(key)
                            }
                            onChange({ ...config, colorTargets: newTargets })
                          }}
                          className="absolute top-0.5 right-0.5 h-6 w-6 cursor-pointer opacity-60 hover:opacity-100"
                          style={{
                            accentColor: 'transparent',
                            backgroundColor: 'transparent',
                            border: '2px solid currentColor'
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Global Color Overlay Control */}
          <Card className="w-full">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label htmlFor="overlay-color" className="text-sm font-medium">
                  Overlay Color (for checked parts)
                </Label>

                {/* Hue Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Hue</span>
                    <span>{Math.round(hexToHue(config.overlayColor || '#ff6b35'))}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hexToHue(config.overlayColor || '#ff6b35')}
                    onChange={(e) => {
                      const hue = parseInt(e.target.value)
                      const hexColor = hueToHex(hue)
                      onChange({ ...config, overlayColor: hexColor })
                    }}
                    className="w-full h-2 rounded-lg cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
                    }}
                  />
                </div>

                {/* Color Picker and Hex Input */}
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <input
                      id="overlay-color"
                      type="color"
                      value={config.overlayColor || '#ff6b35'}
                      onChange={(e) => onChange({ ...config, overlayColor: e.target.value })}
                      className="h-10 w-20 rounded border border-border cursor-pointer opacity-0 absolute inset-0"
                    />
                    <div
                      className="h-10 w-20 rounded border border-border cursor-pointer"
                      style={{ backgroundColor: config.overlayColor || '#ff6b35' }}
                    />
                  </div>
                  <input
                    type="text"
                    value={config.overlayColor || '#ff6b35'}
                    onChange={(e) => onChange({ ...config, overlayColor: e.target.value })}
                    className="flex-1 h-10 px-3 rounded border border-border bg-background text-sm"
                    placeholder="#ff6b35"
                  />
                  {config.overlayColor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange({ ...config, overlayColor: undefined, colorTargets: new Set() })}
                      className="px-3"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center space-x-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRandomize}
              className="flex-1 flex items-center justify-center space-x-2"
            >
              <Shuffle className="h-4 w-4" />
              <span>Randomize</span>
            </Button>

            {onExport && (
              <Button
                variant="default"
                size="sm"
                onClick={handleExport}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>{loading ? 'Exporting...' : 'Use Avatar'}</span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Generate a default/random avatar config
 */
export function generateDefaultAvatarConfig(): AvatarConfig {
  return {
    fell: true,
    hufen: true,
    schwanz: true,
    ohren: true,
    augen: true,
    krawatte: false,
    hut: false,
    punk: false,
  }
}

/**
 * Generate a random avatar config
 */
export function generateRandomAvatarConfig(): AvatarConfig {
  return {
    fell: Math.random() > 0.2,
    hufen: Math.random() > 0.4,
    schwanz: Math.random() > 0.4,
    ohren: Math.random() > 0.2,
    augen: Math.random() > 0.1,
    krawatte: Math.random() > 0.7,
    hut: Math.random() > 0.7,
    punk: Math.random() > 0.8,
  }
}
