# Zero-downtime deployment script for Windows PowerShell
# This script builds and reloads the application without losing HTTP connections or queue jobs

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting zero-downtime deployment..." -ForegroundColor Cyan

# Step 1: Build the application
Write-Host "📦 Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green

# Step 2: Check if PM2 is running
$pm2Status = pm2 list 2>&1
if ($pm2Status -notmatch "group-backend") {
    Write-Host "⚠️  PM2 app not found, starting for the first time..." -ForegroundColor Yellow
    pm2 start ecosystem.config.js
} else {
    Write-Host "🔄 Reloading PM2 cluster (zero-downtime)..." -ForegroundColor Yellow
    # Use reload instead of restart for zero-downtime
    # Reload starts new instances, then stops old ones
    pm2 reload ecosystem.config.js
}

# Step 3: Wait a moment for the reload to complete
Start-Sleep -Seconds 2

# Step 4: Check status
Write-Host "📊 Checking PM2 status..." -ForegroundColor Yellow
pm2 status

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  pm2 logs group-backend    # View logs"
Write-Host "  pm2 monit                 # Monitor resources"
Write-Host "  pm2 reload group-backend  # Reload again (zero-downtime)"

