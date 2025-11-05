# Deployment Guide for Trumps Dashboard

This guide covers all deployment options for the Trumps Dashboard multiplayer game application.

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB (optional - app has in-memory fallback)
- Docker and Docker Compose (for containerized deployment)
- Git (for version control)

## 🚀 Quick Start (Development)

For immediate development setup:

```bash
./dev.sh
```

This will:
- Install all dependencies
- Start development servers
- Open application at http://localhost:3000
- API available at http://localhost:3001

## 📦 Deployment Options

### 1. Local Development

```bash
# Full development environment
./deploy.sh dev

# Quick development setup
./dev.sh

# Stop all services
./stop.sh
```

**Ports:**
- Client: http://localhost:3000
- Server: http://localhost:3001

### 2. Staging Environment

```bash
./deploy.sh staging
```

**Ports:**
- Client: http://localhost:3003
- Server: http://localhost:3002

### 3. Production Environment

```bash
# Build and deploy production
./build-prod.sh

# Or deploy production directly
./deploy.sh prod
```

**Ports:**
- Client: http://localhost:80
- Server: http://localhost:5000

### 4. Docker Deployment

```bash
# Development with Docker
./docker-deploy.sh dev

# Production with Docker
./docker-deploy.sh prod
```

**Docker Services:**
- MongoDB: Persistent database
- Server: Node.js API backend
- Client: React frontend (with Nginx in production)

## 🛠 Available Scripts

### Core Deployment Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `deploy.sh` | Main deployment script | `./deploy.sh [dev\|staging\|prod] [options]` |
| `dev.sh` | Quick development setup | `./dev.sh` |
| `build-prod.sh` | Production build & deploy | `./build-prod.sh` |
| `stop.sh` | Stop all services | `./stop.sh` |
| `docker-deploy.sh` | Docker deployment | `./docker-deploy.sh [dev\|prod]` |

### Utility Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `health-check.sh` | System health check | `./health-check.sh [environment]` |
| `backup.sh` | Backup system | `./backup.sh [environment]` |

### Script Options

**deploy.sh options:**
- `--no-build` - Skip building the application
- `--no-install` - Skip installing dependencies
- `--help` - Show help information

## 🐳 Docker Configuration

### Development
- Uses `docker-compose.yml`
- Hot reloading enabled
- Separate containers for client, server, and MongoDB

### Production
- Uses `docker-compose.prod.yml` overlay
- Optimized builds with multi-stage Dockerfiles
- Nginx reverse proxy for client
- Production MongoDB setup

### Docker Commands

```bash
# Start development environment
docker-compose up -d

# Start production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build -d
```

## 🔧 Environment Configuration

### Environment Variables (server/.env)

```bash
NODE_ENV=development|staging|production
PORT=3001
JWT_SECRET=your-super-secret-jwt-key
MONGODB_URI=mongodb://localhost:27017/trumps-dashboard
CLIENT_URL=http://localhost:3000
```

### MongoDB Setup

**Local MongoDB:**
```bash
# Install MongoDB
brew install mongodb/brew/mongodb-community

# Start MongoDB
brew services start mongodb/brew/mongodb-community
```

**Docker MongoDB:**
```bash
# MongoDB runs automatically in Docker setup
# Access: mongodb://admin:password123@localhost:27017/trumps-dashboard
```

## 🏥 Health Monitoring

### Health Check

```bash
./health-check.sh [environment]
```

Checks:
- Client and server availability
- API endpoint accessibility
- MongoDB connection
- System resources (disk, memory)

### Monitoring Endpoints

- Health: `http://localhost:3001/api/health`
- Server status: `http://localhost:3001/api/status`

## 💾 Backup & Recovery

### Create Backup

```bash
./backup.sh [environment]
```

Creates:
- Source code archive
- MongoDB database dump
- Configuration files
- Backup manifest

### Restore from Backup

```bash
# Extract source code
tar -xzf backups/source_code_TIMESTAMP.tar.gz

# Restore MongoDB
mongorestore backups/mongodb_TIMESTAMP/

# Restore environment files
cp backups/.env_TIMESTAMP server/.env
```

## 🔐 Security Considerations

### Production Checklist

- [ ] Change default JWT secret
- [ ] Use secure MongoDB credentials
- [ ] Enable HTTPS (configure reverse proxy)
- [ ] Set secure environment variables
- [ ] Review CORS settings
- [ ] Enable security headers (configured in nginx.conf)

### Environment Variables for Production

```bash
JWT_SECRET=generate-a-strong-random-secret
MONGO_PASSWORD=secure-mongodb-password
NODE_ENV=production
```

### Docker Security Notes

The Docker images use `node:20-alpine` as the base image with security hardening:
- Latest Node.js LTS version for security patches
- Alpine Linux for minimal attack surface
- Security updates applied during build
- Non-root user for server container
- dumb-init for proper signal handling

Note: VS Code may show security warnings about base images. These are informational and the images include security mitigations.

## 🌐 Nginx Configuration

For production deployment, Nginx is configured to:
- Serve static React files
- Proxy API requests to backend
- Handle Socket.io WebSocket connections
- Enable gzip compression
- Set security headers
- Cache static assets

## 📊 Performance Optimization

### Production Optimizations

- React build optimization
- Gzip compression
- Static file caching
- Database indexing
- Connection pooling

### Monitoring

- Application logs: `docker-compose logs -f`
- System resources: `./health-check.sh`
- Database performance: MongoDB logs

## 🐛 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Find process using port
lsof -i :3000
# Kill process
kill -9 PID
```

**Permission errors:**
```bash
# Make scripts executable
chmod +x *.sh
```

**MongoDB connection issues:**
```bash
# Check MongoDB status
brew services list | grep mongodb
# Restart MongoDB
brew services restart mongodb/brew/mongodb-community
```

**Docker issues:**
```bash
# Clean up Docker
docker system prune -a
# Restart Docker
docker-compose down && docker-compose up -d
```

### Logs

**Application logs:**
- Development: Console output
- Production: PM2 logs or Docker logs

**System logs:**
```bash
# Docker logs
docker-compose logs -f [service-name]

# System logs (macOS)
log stream --predicate 'process == "node"'
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to production
        run: ./build-prod.sh
```

### Deployment Hooks

Pre-deployment:
- Run tests
- Create backup
- Health check

Post-deployment:
- Verify deployment
- Run smoke tests
- Send notifications

## 📱 Mobile & PWA

The application is configured as a Progressive Web App (PWA):
- Responsive design
- Offline capability
- App manifest
- Service worker (in production build)

## 🎯 Load Balancing

For high-traffic deployment:
- Use multiple server instances
- Configure load balancer (Nginx, HAProxy)
- Implement session management
- Database clustering

## 📈 Scaling

### Horizontal Scaling

- Multiple server instances
- Database replication
- CDN for static assets
- Container orchestration (Kubernetes)

### Vertical Scaling

- Increase server resources
- Optimize database queries
- Enable caching
- Profile application performance

---

## 🆘 Support

For deployment issues:
1. Check logs: `./health-check.sh`
2. Verify configuration
3. Review troubleshooting section
4. Create backup before changes: `./backup.sh`

**Quick Recovery:**
```bash
./stop.sh && ./deploy.sh dev
```