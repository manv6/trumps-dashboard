FROM node:20-alpine

WORKDIR /app

# Copy package files for both frontend and server
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --only=production
RUN cd server && npm ci --only=production

# Copy source code
COPY . .

# Build React app
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Start the server
CMD ["npm", "run", "start:production"]