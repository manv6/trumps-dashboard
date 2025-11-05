#!/bin/bash

# Health Check Script
# Usage: ./health-check.sh [environment]

ENVIRONMENT=${1:-dev}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Set ports based on environment
case $ENVIRONMENT in
    dev)
        CLIENT_PORT=3000
        SERVER_PORT=3001
        ;;
    staging)
        CLIENT_PORT=3003
        SERVER_PORT=3002
        ;;
    prod)
        CLIENT_PORT=80
        SERVER_PORT=5000
        ;;
esac

print_header "HEALTH CHECK - $ENVIRONMENT ENVIRONMENT"

# Check if client is running
echo "Checking client service (port $CLIENT_PORT)..."
if curl -f -s http://localhost:$CLIENT_PORT > /dev/null; then
    print_status "Client is running on port $CLIENT_PORT"
else
    print_error "Client is not responding on port $CLIENT_PORT"
fi

# Check if server is running
echo "Checking server service (port $SERVER_PORT)..."
if curl -f -s http://localhost:$SERVER_PORT/api/health > /dev/null; then
    print_status "Server is running on port $SERVER_PORT"
else
    print_error "Server is not responding on port $SERVER_PORT"
fi

# Check server API endpoints
echo "Checking server API endpoints..."
ENDPOINTS=("/api/auth/register" "/api/games" "/api/users/me")

for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f -s http://localhost:$SERVER_PORT$endpoint > /dev/null; then
        print_status "Endpoint $endpoint is accessible"
    else
        print_warning "Endpoint $endpoint returned an error (might be expected)"
    fi
done

# Check if MongoDB is accessible (if running locally)
echo "Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        print_status "MongoDB is accessible"
    else
        print_warning "MongoDB connection failed or not running locally"
    fi
else
    print_warning "mongosh not installed, skipping MongoDB check"
fi

# Check disk space
echo "Checking disk space..."
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    print_status "Disk space is adequate ($DISK_USAGE% used)"
else
    print_error "Disk space is running low ($DISK_USAGE% used)"
fi

# Check memory usage
echo "Checking memory usage..."
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", ($3/$2)*100)}')
    if [ "$MEMORY_USAGE" -lt 90 ]; then
        print_status "Memory usage is normal ($MEMORY_USAGE% used)"
    else
        print_warning "Memory usage is high ($MEMORY_USAGE% used)"
    fi
else
    # macOS alternative
    MEMORY_PRESSURE=$(memory_pressure | grep "System-wide memory free percentage" | awk '{print $5}' | sed 's/%//')
    if [ ! -z "$MEMORY_PRESSURE" ]; then
        if [ "$MEMORY_PRESSURE" -gt 10 ]; then
            print_status "Memory pressure is normal ($MEMORY_PRESSURE% free)"
        else
            print_warning "Memory pressure is high (only $MEMORY_PRESSURE% free)"
        fi
    else
        print_warning "Could not determine memory usage"
    fi
fi

print_header "HEALTH CHECK COMPLETED"