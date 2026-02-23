# Quick Start Guide

## 1. Setup Database

### Option A: Using PowerShell Script (Windows)

```powershell
.\setup-database.ps1
```

### Option B: Manual Setup

```bash
# Start Docker containers
docker-compose up -d

# Create .env file (if not exists)
# Copy DATABASE_URL from .env.example

# Generate Prisma Client
npm run prisma:generate

# Push database schema
npm run prisma:push
```

## 2. Start Application

```bash
npm run start:dev
```

## 3. Test the Queue System

### Populate test messages
```http
POST http://localhost:7777/queue/test/populate-messages
```

This will:
- Add 10 messages with same instanceId across 3 customers (3 groups)
- Add 10 messages with same customerId across 10 instances (10 groups)
- All messages will be saved to database

## 4. View Messages in Database

### Option A: Prisma Studio
```bash
npm run prisma:studio
```
Open browser at `http://localhost:5555`

### Option B: DBeaver
1. Connect to PostgreSQL:
   - Host: `localhost`
   - Port: `5432`
   - Database: `group_queue`
   - Username: `postgres`
   - Password: `postgres`

2. Query messages:
```sql
SELECT * FROM processed_messages 
ORDER BY processed_at ASC;
```

3. Verify group ordering:
```sql
SELECT 
  group_id,
  COUNT(*) as count,
  MIN(processed_at) as first,
  MAX(processed_at) as last
FROM processed_messages
GROUP BY group_id
ORDER BY first ASC;
```

## 5. Check Console Logs

Watch the console for:
- 🚀 Event emission
- 🎯 Event received
- 📝 Job added to queue
- 🔄 Lazy loading (first time only)
- 📨 Message processing
- 💾 Database save

## Expected Behavior

1. **Lazy Loading**: Worker services only instantiated when first job arrives
2. **Group Ordering**: Messages with same groupId processed in order
3. **Database Tracking**: All processed messages saved with timestamps
4. **Concurrent Processing**: Different groups processed in parallel

## Troubleshooting

### Database connection error
- Check Docker: `docker ps`
- Check logs: `docker-compose logs postgres`
- Verify `.env` file has correct DATABASE_URL

### Prisma errors
- Run: `npm run prisma:generate`
- Run: `npm run prisma:push`

### P1002: Migration advisory lock timeout
If `prisma migrate dev` fails with **"Timed out trying to acquire a postgres advisory lock"**:

1. **Stop the app** – Quit any running process that uses the DB (e.g. `npm run start:dev`, Prisma Studio). Those connections hold the lock.
2. Run migrations again: `npm run prisma:migrate`
3. If it still times out, restart Postgres to drop all connections, then migrate:
   - `npm run prisma:postgres-restart`
   - Wait a few seconds, then: `npm run prisma:migrate`

### Redis connection error
- Check Docker: `docker ps`
- Check logs: `docker-compose logs redis`
