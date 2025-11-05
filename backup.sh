#!/bin/bash

# Backup Script for Trumps Dashboard
# Usage: ./backup.sh [environment]

ENVIRONMENT=${1:-dev}
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "BACKUP SCRIPT - $ENVIRONMENT"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup source code
print_status "Backing up source code..."
tar -czf "$BACKUP_DIR/source_code_$TIMESTAMP.tar.gz" \
    --exclude=node_modules \
    --exclude=build \
    --exclude=.git \
    --exclude=backups \
    --exclude=*.log \
    .

# Backup database (if MongoDB is running)
if command -v mongodump &> /dev/null; then
    print_status "Backing up MongoDB database..."
    mongodump --db trumps-dashboard-$ENVIRONMENT --out "$BACKUP_DIR/mongodb_$TIMESTAMP"
else
    print_status "mongodump not available, skipping database backup"
fi

# Backup environment files
print_status "Backing up configuration files..."
if [ -f "server/.env" ]; then
    cp "server/.env" "$BACKUP_DIR/.env_$TIMESTAMP"
fi

# Create backup manifest
print_status "Creating backup manifest..."
cat > "$BACKUP_DIR/manifest_$TIMESTAMP.txt" << EOF
Trumps Dashboard Backup
Created: $(date)
Environment: $ENVIRONMENT
Files:
- source_code_$TIMESTAMP.tar.gz
- mongodb_$TIMESTAMP/ (if MongoDB available)
- .env_$TIMESTAMP (if exists)

Git commit: $(git rev-parse HEAD 2>/dev/null || echo "Not a git repository")
Git branch: $(git branch --show-current 2>/dev/null || echo "Unknown")
EOF

print_status "Backup completed!"
print_status "Backup location: $BACKUP_DIR"
print_status "Files created:"
ls -la "$BACKUP_DIR"/*$TIMESTAMP*