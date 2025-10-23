#!/bin/bash
set -e

# LAMA Browser Deployment Script
# Usage: ./deploy.sh [server] [path]
# Example: ./deploy.sh user@lama.one /var/www/lama.one

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration (can be overridden by arguments)
REMOTE_HOST="${1:-user@lama.one}"
REMOTE_PATH="${2:-/var/www/lama.one}"
BUILD_DIR="browser-ui/dist"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="lama-browser-backup-${TIMESTAMP}.tar.gz"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   LAMA Browser Deployment Script      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Target:${NC} $REMOTE_HOST:$REMOTE_PATH"
echo ""

# Step 1: Build
echo -e "${BLUE}[1/6]${NC} 🔨 Building LAMA Browser..."
if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Step 2: Verify build
echo -e "${BLUE}[2/6]${NC} 🔍 Verifying build output..."
if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo -e "${RED}✗ Build verification failed: index.html not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build verified${NC}"
echo ""

# Step 3: Create tarball
echo -e "${BLUE}[3/6]${NC} 📦 Creating deployment package..."
cd browser-ui
tar -czf ../lama-browser-dist.tar.gz dist/
cd ..
echo -e "${GREEN}✓ Package created: lama-browser-dist.tar.gz${NC}"
echo ""

# Step 4: Upload
echo -e "${BLUE}[4/6]${NC} ⬆️  Uploading to remote server..."
if scp lama-browser-dist.tar.gz $REMOTE_HOST:/tmp/; then
    echo -e "${GREEN}✓ Upload successful${NC}"
else
    echo -e "${RED}✗ Upload failed${NC}"
    rm lama-browser-dist.tar.gz
    exit 1
fi
echo ""

# Step 5: Deploy on remote
echo -e "${BLUE}[5/6]${NC} 🚀 Deploying on remote server..."
ssh $REMOTE_HOST << EOF
    set -e

    # Create backup of current deployment
    if [ -d "$REMOTE_PATH" ]; then
        echo "Creating backup..."
        sudo tar -czf /tmp/$BACKUP_NAME -C $REMOTE_PATH .
        echo "Backup saved: /tmp/$BACKUP_NAME"
    fi

    # Deploy new version
    echo "Removing old deployment..."
    sudo rm -rf ${REMOTE_PATH}.new
    sudo mkdir -p ${REMOTE_PATH}.new

    echo "Extracting new version..."
    sudo tar -xzf /tmp/lama-browser-dist.tar.gz -C ${REMOTE_PATH}.new --strip-components=1

    echo "Switching to new version..."
    sudo rm -rf ${REMOTE_PATH}.old
    if [ -d "$REMOTE_PATH" ]; then
        sudo mv $REMOTE_PATH ${REMOTE_PATH}.old
    fi
    sudo mv ${REMOTE_PATH}.new $REMOTE_PATH

    echo "Setting permissions..."
    sudo chown -R www-data:www-data $REMOTE_PATH 2>/dev/null || sudo chown -R nginx:nginx $REMOTE_PATH 2>/dev/null || true
    sudo chmod -R 755 $REMOTE_PATH

    # Cleanup
    rm /tmp/lama-browser-dist.tar.gz

    echo "Deployment complete!"
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment successful${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    echo -e "${YELLOW}To rollback, SSH to server and run:${NC}"
    echo -e "${YELLOW}  sudo rm -rf $REMOTE_PATH${NC}"
    echo -e "${YELLOW}  sudo mv ${REMOTE_PATH}.old $REMOTE_PATH${NC}"
    rm lama-browser-dist.tar.gz
    exit 1
fi
echo ""

# Step 6: Cleanup
echo -e "${BLUE}[6/6]${NC} 🧹 Cleaning up..."
rm lama-browser-dist.tar.gz
echo -e "${GREEN}✓ Local cleanup complete${NC}"
echo ""

# Success message
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✓ Deployment Completed!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌐 Your application should now be live at:${NC}"
echo -e "   https://lama.one"
echo ""
echo -e "${YELLOW}📝 Backup location on server:${NC}"
echo -e "   /tmp/$BACKUP_NAME"
echo ""
echo -e "${YELLOW}🔄 To rollback:${NC}"
echo -e "   ssh $REMOTE_HOST"
echo -e "   sudo rm -rf $REMOTE_PATH"
echo -e "   sudo mv ${REMOTE_PATH}.old $REMOTE_PATH"
echo ""
