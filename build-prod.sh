#!/bin/bash

# Production Build and Deploy Script
# Usage: ./build-prod.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "PRODUCTION BUILD & DEPLOY"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing client dependencies..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    print_status "Installing server dependencies..."
    cd server && npm install && cd ..
fi

# Run tests
print_status "Running tests..."
npm test -- --coverage --watchAll=false || {
    print_error "Tests failed. Fix tests before deploying to production."
    exit 1
}

# Build for production
print_status "Building for production..."
npm run build

# Verify build
if [ ! -d "build" ]; then
    print_error "Build directory not created. Build failed."
    exit 1
fi

print_status "Build completed successfully!"
print_status "Build size:"
du -sh build/

# Deploy to production
print_status "Deploying to production..."
./deploy.sh prod

print_status "Production deployment completed!"
print_status "Application is running at: http://localhost:5000"