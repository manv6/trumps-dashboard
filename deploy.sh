#!/bin/bash

# Trumps Dashboard Deployment Script
# Usage: ./deploy.sh [environment] [options]
# Environments: dev, staging, prod
# Options: --no-build, --no-install, --help

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
SKIP_BUILD=false
SKIP_INSTALL=false
SERVER_PORT=3001
CLIENT_PORT=3000

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to show help
show_help() {
    echo "Trumps Dashboard Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  dev       - Development environment (default)"
    echo "  staging   - Staging environment"
    echo "  prod      - Production environment"
    echo ""
    echo "Options:"
    echo "  --no-build     Skip building the application"
    echo "  --no-install   Skip installing dependencies"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh dev"
    echo "  ./deploy.sh prod --no-install"
    echo "  ./deploy.sh staging --no-build"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        dev|staging|prod)
            ENVIRONMENT="$1"
            shift
            ;;
        --no-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-install)
            SKIP_INSTALL=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set environment-specific configurations
case $ENVIRONMENT in
    dev)
        print_header "DEVELOPMENT DEPLOYMENT"
        SERVER_PORT=3001
        CLIENT_PORT=3000
        ;;
    staging)
        print_header "STAGING DEPLOYMENT"
        SERVER_PORT=3002
        CLIENT_PORT=3003
        ;;
    prod)
        print_header "PRODUCTION DEPLOYMENT"
        SERVER_PORT=5000
        CLIENT_PORT=80
        ;;
esac

print_status "Deploying to: $ENVIRONMENT environment"
print_status "Server port: $SERVER_PORT"
print_status "Client port: $CLIENT_PORT"

# Check if required files exist
if [ ! -f "package.json" ]; then
    print_error "package.json not found in current directory"
    exit 1
fi

if [ ! -f "server/package.json" ]; then
    print_error "server/package.json not found"
    exit 1
fi

# Create environment file for server
print_status "Creating environment configuration..."
cat > server/.env << EOF
NODE_ENV=$ENVIRONMENT
PORT=$SERVER_PORT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
MONGODB_URI=mongodb://localhost:27017/trumps-dashboard-$ENVIRONMENT
CLIENT_URL=http://localhost:$CLIENT_PORT
EOF

# Install dependencies
if [ "$SKIP_INSTALL" = false ]; then
    print_status "Installing client dependencies..."
    npm install
    
    print_status "Installing server dependencies..."
    cd server
    npm install
    cd ..
else
    print_warning "Skipping dependency installation"
fi

# Kill existing processes
print_status "Stopping existing processes..."
pkill -f "react-scripts start" || true
pkill -f "node server.js" || true
pkill -f "nodemon server.js" || true

# Build client for production
if [ "$ENVIRONMENT" = "prod" ] && [ "$SKIP_BUILD" = false ]; then
    print_status "Building client for production..."
    npm run build
elif [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping build step"
fi

# Start services based on environment
if [ "$ENVIRONMENT" = "dev" ]; then
    print_status "Starting development servers..."
    
    # Start server in background
    cd server
    npm run dev &
    SERVER_PID=$!
    cd ..
    
    # Wait a moment for server to start
    sleep 3
    
    # Start client
    BROWSER=none PORT=$CLIENT_PORT npm start &
    CLIENT_PID=$!
    
    print_status "Development servers started!"
    print_status "Client: http://localhost:$CLIENT_PORT"
    print_status "Server: http://localhost:$SERVER_PORT"
    print_status "Server PID: $SERVER_PID"
    print_status "Client PID: $CLIENT_PID"
    
    # Create PID file for easy cleanup
    echo "$SERVER_PID" > .server.pid
    echo "$CLIENT_PID" > .client.pid
    
elif [ "$ENVIRONMENT" = "staging" ]; then
    print_status "Starting staging servers..."
    
    # Start server
    cd server
    PORT=$SERVER_PORT npm start &
    SERVER_PID=$!
    cd ..
    
    # Serve built files or start dev server
    if [ -d "build" ]; then
        npx serve -s build -l $CLIENT_PORT &
        CLIENT_PID=$!
    else
        BROWSER=none PORT=$CLIENT_PORT npm start &
        CLIENT_PID=$!
    fi
    
    echo "$SERVER_PID" > .server.pid
    echo "$CLIENT_PID" > .client.pid
    
    print_status "Staging servers started!"
    print_status "Client: http://localhost:$CLIENT_PORT"
    print_status "Server: http://localhost:$SERVER_PORT"
    
elif [ "$ENVIRONMENT" = "prod" ]; then
    print_status "Starting production servers..."
    
    # Start server
    cd server
    PORT=$SERVER_PORT NODE_ENV=production npm start &
    SERVER_PID=$!
    cd ..
    
    # Serve built files
    if [ ! -d "build" ]; then
        print_error "Build directory not found. Run 'npm run build' first."
        exit 1
    fi
    
    npx serve -s build -l $CLIENT_PORT &
    CLIENT_PID=$!
    
    echo "$SERVER_PID" > .server.pid
    echo "$CLIENT_PID" > .client.pid
    
    print_status "Production servers started!"
    print_status "Client: http://localhost:$CLIENT_PORT"
    print_status "Server: http://localhost:$SERVER_PORT"
fi

print_status "Deployment completed successfully!"
print_status "Use './stop.sh' to stop all services"