# Database Setup Script for Windows PowerShell

Write-Host "🚀 Setting up database..." -ForegroundColor Green

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/group_queue?schema=public"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
MESSAGE_QUEUE_CONCURRENCY=5
IMPORTATIONS_QUEUE_CONCURRENCY=3
EXPORTATIONS_QUEUE_CONCURRENCY=3
KEEP_COMPLETED_JOBS=1000
KEEP_FAILED_JOBS=1000
PORT=7777
NODE_ENV=development
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "✅ .env file created" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Start Docker containers
Write-Host "🐳 Starting Docker containers..." -ForegroundColor Yellow
docker-compose up -d

# Wait for PostgreSQL to be ready
Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Generate Prisma Client
Write-Host "🔧 Generating Prisma Client..." -ForegroundColor Yellow
npm run prisma:generate

# Push database schema
Write-Host "📊 Pushing database schema..." -ForegroundColor Yellow
npm run prisma:push

Write-Host "✅ Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start your application: npm run start:dev" -ForegroundColor White
Write-Host "  2. Test the endpoint: POST http://localhost:7777/queue/test/populate-messages" -ForegroundColor White
Write-Host "  3. View data in DBeaver or run: npm run prisma:studio" -ForegroundColor White
