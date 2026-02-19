#!/bin/bash
set -e

# LAMA Browser Deploy Script
# Usage: ./deploy.sh [--build-only]
#
# Builds and deploys to Cloudflare Pages
# Use --build-only to skip deployment

BUILD_ONLY=false
if [ "$1" == "--build-only" ]; then
    BUILD_ONLY=true
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BUILD_DIR="browser-ui/dist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGES_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   LAMA Browser Deploy Script           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Rebuild dependencies (in dependency order)
echo -e "${BLUE}[1/3]${NC} Rebuilding dependencies..."

# Rebuild one.core (foundation - CHUM sync, storage)
echo -e "  Building one.core..."
if (cd "$PACKAGES_DIR/one.core" && pnpm build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ one.core${NC}"
else
    echo -e "  ${RED}✗ one.core build failed${NC}"
    exit 1
fi

# Rebuild one.models (depends on one.core)
echo -e "  Building one.models..."
if (cd "$PACKAGES_DIR/one.models" && pnpm build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ one.models${NC}"
else
    echo -e "  ${RED}✗ one.models build failed${NC}"
    exit 1
fi

# Rebuild refinio.api (depends on one.models)
echo -e "  Building refinio.api..."
if (cd "$PACKAGES_DIR/refinio.api" && pnpm build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ refinio.api${NC}"
else
    echo -e "  ${YELLOW}⚠ refinio.api (skipped or failed)${NC}"
fi

# Rebuild chat.core (depends on one.models)
echo -e "  Building chat.core..."
if (cd "$PACKAGES_DIR/chat.core" && pnpm build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ chat.core${NC}"
else
    echo -e "  ${YELLOW}⚠ chat.core (skipped or failed)${NC}"
fi

# Rebuild lama.core (depends on chat.core)
echo -e "  Building lama.core..."
if (cd "$PACKAGES_DIR/lama.core" && pnpm build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ lama.core${NC}"
else
    echo -e "  ${RED}✗ lama.core build failed${NC}"
    exit 1
fi

# Rebuild lama.ui (UI components)
echo -e "  Building lama.ui..."
if (cd "$PACKAGES_DIR/lama.ui" && pnpm build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ lama.ui${NC}"
else
    echo -e "  ${YELLOW}⚠ lama.ui (skipped or failed)${NC}"
fi

echo -e "${GREEN}✓ Dependencies rebuilt${NC}"
echo ""

# Step 2: Build lama.browser
echo -e "${BLUE}[2/3]${NC} Building LAMA Browser..."
if pnpm build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Verify build
if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo -e "${RED}✗ Build verification failed: index.html not found${NC}"
    exit 1
fi
echo ""

if [ "$BUILD_ONLY" = true ]; then
    echo -e "${GREEN}✓ Build complete (--build-only)${NC}"
    echo -e "${BLUE}📁 Output:${NC} $BUILD_DIR/"
    exit 0
fi

# Step 3: Deploy to Cloudflare Pages
echo -e "${BLUE}[3/3]${NC} Deploying to Cloudflare Pages..."
if command -v npx &> /dev/null; then
    if npx wrangler pages deploy browser-ui/dist --project-name=lama-one --commit-dirty=true; then
        echo -e "${GREEN}✓ Deployed to Cloudflare Pages${NC}"
    else
        echo -e "${RED}✗ Cloudflare deployment failed${NC}"
        echo -e "${YELLOW}  Make sure you're logged in: npx wrangler login${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ npx not found${NC}"
    exit 1
fi
echo ""

# Success message
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✓ Deploy Completed!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📁 Build output:${NC} browser-ui/dist/"
echo -e "${BLUE}☁️  Live at:${NC} https://lama-one.pages.dev"
echo ""
