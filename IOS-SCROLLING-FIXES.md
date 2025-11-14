# iOS Scrolling Fixes for lama.browser

## Problem
When running lama.browser as a standalone app on iOS, users experienced scrolling issues including:
- Messages not scrolling smoothly (lack of momentum scrolling)
- Stuck scroll positions
- Rubber-band/bounce effects at the page level
- Issues with nested scrollable containers

## Root Causes

1. **Missing `-webkit-overflow-scrolling: touch`** - iOS requires this property for momentum scrolling
2. **Multiple nested `overflow-hidden` containers** - Breaks iOS scrolling behavior
3. **Body/HTML overflow settings** - Need special handling for iOS standalone mode
4. **Fixed positioning conflicts** - Bottom tab bar + dynamic iOS UI (address bar) caused layout issues

## Fixes Applied

### 1. Global CSS Fixes (`browser-ui/src/index.css`)

#### iOS Momentum Scrolling
```css
/* iOS-specific scrolling fixes */
.ios-scroll {
  -webkit-overflow-scrolling: touch;
  overflow-scrolling: touch;
}

/* Fix for iOS momentum scrolling in all overflow containers */
@supports (-webkit-touch-callout: none) {
  [class*="overflow-y-auto"],
  [class*="overflow-auto"],
  .overflow-y-auto,
  .overflow-auto {
    -webkit-overflow-scrolling: touch;
    overflow-scrolling: touch;
  }
}
```

#### Standalone Mode Fixes
```css
@media (hover: none) and (pointer: coarse) {
  html {
    -webkit-text-size-adjust: 100%;
    height: 100%;
    overflow: hidden;
  }

  body {
    height: 100%;
    overflow: hidden;
    position: fixed;
    width: 100%;
  }

  #root {
    height: 100%;
    overflow: hidden;
  }
}
```

#### Prevent Pull-to-Refresh
```css
@media (display-mode: standalone) {
  html {
    overscroll-behavior-y: contain;
  }
}
```

### 2. Component-Level Fixes

#### MessageView.tsx (Main Chat Scroll)
```tsx
// Before
<div className="flex-1 px-4 py-2 overflow-y-auto" ref={scrollAreaRef} ...>

// After
<div
  className="flex-1 px-4 py-2 overflow-y-auto ios-scroll"
  ref={scrollAreaRef}
  style={{
    minHeight: 0,
    WebkitOverflowScrolling: 'touch',
    overflowScrolling: 'touch'
  }}
>
```

#### ChatLayout.tsx (Container Fixes)
- Changed `className="overflow-hidden"` to inline `style={{ overflow: 'hidden' }}`
- Prevents Tailwind from interfering with iOS scrolling behavior
- Maintains overflow control without breaking touch scrolling

#### App.tsx (Safe Area Handling)
```tsx
// Before
style={{ paddingBottom: window.innerWidth < 768 ? 'calc(env(safe-area-inset-bottom) + 64px)' : '0' }}

// After
style={{
  overflow: 'hidden',
  paddingBottom: window.innerWidth < 768 ? 'calc(env(safe-area-inset-bottom, 0px) + 64px)' : '0'
}}
```
Added fallback value for `safe-area-inset-bottom` to handle browsers that don't support it.

#### Other Components
Applied `ios-scroll` class and `-webkit-overflow-scrolling: touch` to:
- ChatView.tsx (subject detail panel)
- TopicSummary.tsx (version history)
- PurchaseView.tsx (main scroll area)
- MessageView.tsx (keyword detail panel)

## Key Principles

1. **Always use `-webkit-overflow-scrolling: touch`** for any scrollable area on iOS
2. **Avoid nested `overflow-hidden` in Tailwind classes** - Use inline styles when needed
3. **Body and HTML must be `position: fixed`** in standalone mode to prevent page-level bounce
4. **Use `overscroll-behavior-y: contain`** to disable pull-to-refresh in standalone mode
5. **Always provide fallback values** for CSS env() variables

## iOS Keyboard Toolbar Handling (NEW)

### Problem
When the iOS keyboard appears, it shows a toolbar above it with:
- Up/down chevrons (to navigate between input fields)
- Checkmark/Done button

This toolbar obscures the message input field, making it hard for users to see what they're typing.

### Solution

#### JavaScript Scroll Handling (`EnhancedMessageInput.tsx`)

Added automatic scroll adjustment when the keyboard appears:

```typescript
// iOS keyboard handling - scroll input above keyboard toolbar
useEffect(() => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!isIOS) return;

  const scrollTextareaIntoView = () => {
    // Scroll input into view at bottom of viewport
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
      inline: 'nearest'
    });

    // Additional 50px clearance for keyboard toolbar
    scrollContainer.scrollTop += 50;
  };

  // Listen for focus and viewport resize events
  textarea.addEventListener('focus', handleFocus);
  window.addEventListener('resize', handleViewportResize);
  window.visualViewport?.addEventListener('resize', handleViewportResize);
}, []);
```

**Key Features:**
- Detects iOS device using user agent
- Listens for focus events when user taps input
- Listens for viewport resize (iOS fires this when keyboard appears)
- Uses Visual Viewport API for accurate keyboard detection
- Scrolls input with 50px clearance above keyboard toolbar
- Smooth animation with proper timing (350ms delay for keyboard animation)

#### CSS Enhancements (`EnhancedMessageInput.css`)

```css
@supports (-webkit-touch-callout: none) {
  .message-textarea:focus {
    scroll-margin-bottom: 60px; /* Extra space for keyboard toolbar */
  }

  @media (display-mode: standalone) {
    .enhanced-message-input {
      padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px);
    }
  }
}
```

## Testing Checklist

Test the following on an iOS device in standalone mode (add to home screen):

- [ ] Chat messages scroll smoothly with momentum
- [ ] Scrolling doesn't stick or freeze
- [ ] No rubber-band effect at the page level
- [ ] Bottom tab bar stays fixed and doesn't overlap content
- [ ] Safe area insets are respected (notch, home indicator)
- [ ] Pull-to-refresh is disabled
- [ ] Sidebar scrolling works smoothly
- [ ] Settings and other views scroll properly
- [ ] Nested scrollable areas (modals, dropdowns) work correctly
- [ ] **Keyboard appears: Input scrolls above toolbar (chevrons/checkmark visible below input)**
- [ ] **User can see what they're typing when keyboard is visible**
- [ ] **Keyboard dismisses: Layout returns to normal without issues**
- [ ] **Switching conversations: Input auto-focuses and scrolls properly**

## Browser Support

These fixes target:
- iOS Safari 13+
- iOS standalone mode (PWA)
- iOS WebView (in-app browsers)

Desktop browsers are unaffected by these changes.

## Files Modified

1. `browser-ui/src/index.css` - Global iOS scrolling styles
2. `browser-ui/src/components/MessageView.tsx` - Main chat scroll area
3. `browser-ui/src/components/ChatLayout.tsx` - Container overflow fixes
4. `browser-ui/src/App.tsx` - Safe area padding
5. `browser-ui/src/components/ChatView.tsx` - Subject panel
6. `browser-ui/src/components/TopicSummary/TopicSummary.tsx` - Version history
7. `browser-ui/src/components/PurchaseView.tsx` - Purchase view scroll
8. **`browser-ui/src/components/chat/EnhancedMessageInput.tsx` - iOS keyboard scroll handling**
9. **`browser-ui/src/components/chat/EnhancedMessageInput.css` - iOS keyboard CSS fixes**

## References

- [Apple: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [MDN: -webkit-overflow-scrolling](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-overflow-scrolling)
- [MDN: overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)
- [CSS Tricks: The CSS env() Function](https://css-tricks.com/css-env-function/)
