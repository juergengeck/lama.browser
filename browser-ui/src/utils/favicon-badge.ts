/**
 * Favicon Badge Utility
 *
 * Dynamically updates the browser favicon with a pink circular badge showing unread message count.
 * Inspired by WhatsApp's favicon badge design - clean circular badge with white text.
 */

// Pink/magenta color from LAMA branding (matching the gradient secondary color)
const LAMA_PINK = '#ec4899' // pink-500

/**
 * Get the appropriate favicon based on the current color scheme
 * @returns Path to the favicon SVG (white for dark mode, black for light mode)
 */
function getFaviconPath(): string {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? '/assets/icons/lama_f_w.svg' : '/assets/icons/lama_f_b.svg'
}

/**
 * Update the favicon with a pink circular badge showing the unread count
 * @param count - Number of unread messages (0 to clear badge)
 */
export function updateFaviconBadge(count: number): void {
  // Get the current favicon link element
  let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

  if (!faviconLink) {
    // Create favicon link if it doesn't exist
    faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'
    faviconLink.type = 'image/png'
    document.head.appendChild(faviconLink)
  }

  // If count is 0, restore appropriate favicon based on theme
  if (count === 0) {
    faviconLink.type = 'image/svg+xml'
    faviconLink.href = getFaviconPath()
    return
  }

  // Create a canvas to draw the badge favicon
  const canvas = document.createElement('canvas')
  const size = 256 // Large canvas for crisp rendering on all displays
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    console.error('[FaviconBadge] Failed to get canvas context')
    return
  }

  // Enable better rendering
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Clear canvas with transparent background
  ctx.clearRect(0, 0, size, size)

  // Draw pink circular badge (fills entire favicon, like WhatsApp)
  const centerX = size / 2
  const centerY = size / 2
  const radius = size / 2 // No padding - fill the entire space

  // Draw solid pink circle
  ctx.fillStyle = LAMA_PINK
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
  ctx.fill()

  // Draw count text
  ctx.fillStyle = '#ffffff'

  // Adjust font size and weight based on count length (WhatsApp style)
  const text = count > 99 ? '99+' : count.toString()
  let fontSize: number

  if (text.length === 1) {
    fontSize = 180 // Single digit - large and prominent (scaled for 256px canvas)
  } else if (text.length === 2) {
    fontSize = 150 // Two digits - still quite large
  } else {
    fontSize = 120 // "99+" - compact but readable
  }

  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Draw text at true center. With 'middle' baseline, centerY is the correct vertical alignment.
  ctx.fillText(text, centerX, centerY)

  // Update favicon with the new canvas image
  faviconLink.type = 'image/png'
  faviconLink.href = canvas.toDataURL('image/png')
}

/**
 * Clear the favicon badge (restore original favicon)
 */
export function clearFaviconBadge(): void {
  updateFaviconBadge(0)
}

/**
 * Initialize theme change listener to update favicon when system theme changes
 * Call this once during app initialization
 */
export function initFaviconThemeListener(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // Only update if there's no badge active (SVG type means no badge)
    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (faviconLink?.type === 'image/svg+xml') {
      faviconLink.href = getFaviconPath()
    }
  })
}
