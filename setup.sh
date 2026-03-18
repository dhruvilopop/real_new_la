#!/bin/bash

# Money Mitra - Setup Script for New Session
# Run this when you start a new session to download the latest code

echo "🔄 Money Mitra Setup Script"
echo "==========================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Repository URL (use your GitHub token)
# Replace YOUR_TOKEN with your actual GitHub Personal Access Token
REPO_URL="https://YOUR_TOKEN@github.com/dhruvilopop/real_new_la.git"

# Check if project folder exists
if [ -d "/home/z/my-project" ]; then
    echo -e "${YELLOW}📁 Project folder exists, pulling latest changes...${NC}"
    cd /home/z/my-project
    git pull origin master
else
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    git clone $REPO_URL /home/z/my-project
    cd /home/z/my-project
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
bun install

# Generate Prisma client
echo -e "${YELLOW}🔧 Generating Prisma client...${NC}"
bun run db:generate

# Setup environment file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚙️ Creating .env file...${NC}"
    echo 'DATABASE_URL="mysql://u366636586_new_loan:Mahadev%406163@77.37.35.177:3306/u366636586_new_loan"' > .env
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
echo "   Run 'bun run dev' to start the development server"
