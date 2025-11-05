#!/bin/bash

# Stop Trumps Dashboard Services
# Usage: ./stop.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Stopping Trumps Dashboard services..."

# Stop processes using PID files if they exist
if [ -f ".server.pid" ]; then
    SERVER_PID=$(cat .server.pid)
    if kill -0 $SERVER_PID 2>/dev/null; then
        kill $SERVER_PID
        print_status "Stopped server (PID: $SERVER_PID)"
    else
        print_warning "Server process (PID: $SERVER_PID) not running"
    fi
    rm .server.pid
fi

if [ -f ".client.pid" ]; then
    CLIENT_PID=$(cat .client.pid)
    if kill -0 $CLIENT_PID 2>/dev/null; then
        kill $CLIENT_PID
        print_status "Stopped client (PID: $CLIENT_PID)"
    else
        print_warning "Client process (PID: $CLIENT_PID) not running"
    fi
    rm .client.pid
fi

# Kill any remaining processes
print_status "Killing any remaining processes..."
pkill -f "react-scripts start" || true
pkill -f "node server.js" || true
pkill -f "nodemon server.js" || true
pkill -f "serve -s build" || true

print_status "All services stopped successfully!"