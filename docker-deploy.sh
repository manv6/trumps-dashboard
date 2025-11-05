#!/bin/bash

# Docker Deployment Script
# Usage: ./docker-deploy.sh [environment]

set -e

ENVIRONMENT=${1:-dev}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "DOCKER DEPLOYMENT - $ENVIRONMENT"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Use docker compose or docker-compose based on availability
DOCKER_COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
fi

print_status "Using: $DOCKER_COMPOSE_CMD"

# Stop existing containers
print_status "Stopping existing containers..."
$DOCKER_COMPOSE_CMD down || true

# Build and start containers
if [ "$ENVIRONMENT" = "prod" ]; then
    print_status "Building and starting production containers..."
    $DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml up --build -d
else
    print_status "Building and starting development containers..."
    $DOCKER_COMPOSE_CMD up --build -d
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check if services are running
if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    print_status "Docker deployment completed successfully!"
    print_status "Services are running:"
    $DOCKER_COMPOSE_CMD ps
    
    if [ "$ENVIRONMENT" = "prod" ]; then
        print_status "Application is available at: http://localhost"
    else
        print_status "Application is available at: http://localhost:3000"
        print_status "API is available at: http://localhost:3001"
    fi
    
    print_status "To view logs: $DOCKER_COMPOSE_CMD logs -f"
    print_status "To stop: $DOCKER_COMPOSE_CMD down"
else
    print_error "Some services failed to start. Check logs:"
    $DOCKER_COMPOSE_CMD logs
    exit 1
fi