#!/bin/bash

echo "🚀 Deploying to Railway..."

# Build the React app
echo "📦 Building React app..."
npm run build

# Copy server files to build directory for unified deployment
echo "📁 Preparing unified deployment..."
cp -r server build/
cp package*.json build/

# Create Railway start script
cat > build/start.sh << 'EOF'
#!/bin/bash
cd server
npm install --production
node server.js
EOF

chmod +x build/start.sh

echo "✅ Ready for Railway deployment!"
echo ""
echo "Next steps:"
echo "1. Go to https://railway.app"
echo "2. Connect your GitHub repo"
echo "3. Deploy!"
echo ""
echo "Or use Railway CLI:"
echo "npm install -g @railway/cli"
echo "railway login"
echo "railway link"
echo "railway up"