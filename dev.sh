#!/bin/bash

# Quick Development Setup Script
# Usage: ./dev.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "QUICK DEVELOPMENT SETUP"

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    cd server && npm install && cd ..
fi

# Start development environment
print_status "Starting development environment..."
./deploy.sh dev

print_status "Development environment is ready!"
print_status "Client: http://localhost:3000"
print_status "Server: http://localhost:3001"