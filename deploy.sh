#!/bin/bash
set -e

# LAMA Browser Build Script
# Usage: ./deploy.sh
#
# Builds the browser UI and creates deployment packages in ./deploy/

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
echo -e "${BLUE}║   LAMA Browser Build Script           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Rebuild dependencies (in dependency order)
echo -e "${BLUE}[1/4]${NC} 🔄 Rebuilding dependencies..."

# Rebuild one.core (foundation - CHUM sync, storage)
echo -e "  Building one.core..."
if (cd "$PACKAGES_DIR/one.core" && npm run build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ one.core${NC}"
else
    echo -e "  ${RED}✗ one.core build failed${NC}"
    exit 1
fi

# Rebuild one.models (depends on one.core)
echo -e "  Building one.models (src only)..."
if (cd "$PACKAGES_DIR/one.models" && npm run build:src 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ one.models${NC}"
else
    echo -e "  ${RED}✗ one.models build failed${NC}"
    exit 1
fi

# Rebuild chat.core (depends on one.models)
echo -e "  Building chat.core..."
if (cd "$PACKAGES_DIR/chat.core" && npm run build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ chat.core${NC}"
else
    echo -e "  ${YELLOW}⚠ chat.core (skipped or failed)${NC}"
fi

# Rebuild lama.core (depends on chat.core)
echo -e "  Building lama.core..."
if (cd "$PACKAGES_DIR/lama.core" && npm run build 2>&1 | tail -3); then
    echo -e "  ${GREEN}✓ lama.core${NC}"
else
    echo -e "  ${RED}✗ lama.core build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies rebuilt${NC}"
echo ""

# Step 2: Build lama.browser
echo -e "${BLUE}[2/4]${NC} 🔨 Building LAMA Browser..."
if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Step 3: Verify build
echo -e "${BLUE}[3/4]${NC} 🔍 Verifying build output..."
if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo -e "${RED}✗ Build verification failed: index.html not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build verified${NC}"
echo ""

# Step 4: Create archives (optional, for manual hosting)
echo -e "${BLUE}[4/4]${NC} 📦 Creating deployment archives..."
mkdir -p deploy
rm -f deploy/lama-browser.tar.gz deploy/lama-browser.zip

cd browser-ui
tar -czf ../deploy/lama-browser.tar.gz dist/
zip -r ../deploy/lama-browser.zip dist/
cd ..
echo -e "${GREEN}✓ Archives created in deploy/${NC}"
echo ""

# Success message
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✓ Build Completed!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📁 Build output:${NC} browser-ui/dist/"
echo -e "${BLUE}📦 Archives:${NC} deploy/lama-browser.{tar.gz,zip}"
echo ""
echo -e "${YELLOW}💡 Deploy:${NC}"
echo -e "   Cloudflare Pages serves from ${GREEN}browser-ui/dist/${NC}"
echo -e "   Manual hosting: use deploy/lama-browser.tar.gz"
echo ""
