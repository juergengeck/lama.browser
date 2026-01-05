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

# Step 1: Rebuild dependencies
echo -e "${BLUE}[1/4]${NC} 🔄 Rebuilding dependencies..."

# Rebuild lama.core (critical - contains business logic)
echo -e "  Building lama.core..."
if (cd "$PACKAGES_DIR/lama.core" && npm run build); then
    echo -e "  ${GREEN}✓ lama.core${NC}"
else
    echo -e "  ${RED}✗ lama.core build failed${NC}"
    exit 1
fi

# Rebuild chat.core
echo -e "  Building chat.core..."
if (cd "$PACKAGES_DIR/chat.core" && npm run build 2>/dev/null); then
    echo -e "  ${GREEN}✓ chat.core${NC}"
else
    echo -e "  ${YELLOW}⚠ chat.core (skipped or failed)${NC}"
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

# Step 4: Create packages
echo -e "${BLUE}[4/4]${NC} 📦 Creating deployment packages..."
mkdir -p deploy
rm -rf deploy/lama.browser deploy/lama-browser.tar.gz deploy/lama-browser.zip
cp -r browser-ui/dist deploy/lama.browser

cd deploy
tar -czf lama-browser.tar.gz lama.browser/
zip -r lama-browser.zip lama.browser/
cd ..
echo -e "${GREEN}✓ Packages created in deploy/${NC}"
echo ""

# Success message
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✓ Build Completed!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📦 Deployment packages:${NC}"
echo -e "   deploy/lama-browser.tar.gz"
echo -e "   deploy/lama-browser.zip"
echo -e "   deploy/lama.browser/ (directory)"
echo ""
echo -e "${YELLOW}💡 Deploy Options:${NC}"
echo -e "   ${BLUE}1.${NC} Production: ${GREEN}git push origin main${NC} (auto-deploys via Cloudflare Pages)"
echo -e "   ${BLUE}2.${NC} Preview: ${GREEN}git push origin <branch>${NC} (creates preview deployment)"
echo -e "   ${BLUE}3.${NC} Manual: Use deploy/lama-browser.tar.gz for your own hosting"
echo ""
