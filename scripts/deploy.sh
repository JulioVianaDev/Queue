#!/bin/bash

# Zero-downtime deployment script
# This script builds and reloads the application without losing HTTP connections or queue jobs

set -e  # Exit on error

echo "🚀 Starting zero-downtime deployment..."

# Step 1: Build the application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed! Aborting deployment."
  exit 1
fi

echo "✅ Build successful"

# Step 2: Check if PM2 is running
if ! pm2 list | grep -q "group-backend"; then
  echo "⚠️  PM2 app not found, starting for the first time..."
  pm2 start ecosystem.config.js
else
  echo "🔄 Reloading PM2 cluster (zero-downtime)..."
  # Use reload instead of restart for zero-downtime
  # Reload starts new instances, then stops old ones
  pm2 reload ecosystem.config.js
fi

# Step 3: Wait a moment for the reload to complete
sleep 2

# Step 4: Check status
echo "📊 Checking PM2 status..."
pm2 status

echo "✅ Deployment complete!"
echo ""
echo "Useful commands:"
echo "  pm2 logs group-backend    # View logs"
echo "  pm2 monit                 # Monitor resources"
echo "  pm2 reload group-backend  # Reload again (zero-downtime)"

