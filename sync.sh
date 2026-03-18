#!/bin/bash

# Money Mitra - Sync Script
# This script syncs your code to GitHub so you can continue from any session

echo "🔄 Money Mitra Sync Script"
echo "=========================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✅ No changes to commit${NC}"
else
    echo -e "${YELLOW}📝 Changes detected, committing...${NC}"
    git add -A
    git commit -m "auto: Sync changes $(date '+%Y-%m-%d %H:%M:%S')"
fi

# Push to GitHub
echo -e "${YELLOW}🚀 Pushing to GitHub...${NC}"
git push origin master

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully synced to GitHub!${NC}"
    echo "   Repository: https://github.com/dhruvilopop/real_new_la"
else
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    exit 1
fi
