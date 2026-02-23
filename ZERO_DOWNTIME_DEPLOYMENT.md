# Zero-Downtime Deployment Guide

This guide explains how to deploy updates without losing HTTP connections or interrupting queue job processing.

## How Zero-Downtime Works

### PM2 Reload Process

1. **New instances start**: PM2 starts new instances with the updated code
2. **Health check**: New instances signal readiness (`process.send('ready')`)
3. **Traffic migration**: PM2 routes new connections to new instances
4. **Graceful shutdown**: Old instances finish current jobs, then close
5. **No downtime**: At least one instance is always serving traffic

### Queue Safety

- **Jobs in Redis**: All jobs are stored in Redis, not in application memory
- **Worker coordination**: GroupMQ uses Redis locks - jobs are never lost
- **Graceful worker shutdown**: Workers finish current jobs before closing (30s timeout)
- **Automatic recovery**: If a worker crashes, other instances pick up the jobs

## Deployment Methods

### Method 1: Using npm Scripts (Recommended)

```bash
# Build and reload (zero-downtime)
npm run deploy

# Or if starting for the first time
npm run deploy:start
```

### Method 2: Using PM2 Directly

```bash
# Build first
npm run build

# Then reload (zero-downtime)
npm run pm2:reload

# Or use PM2 directly
pm2 reload ecosystem.config.js
```

### Method 3: Using Deployment Scripts

**Linux/Mac:**

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Windows PowerShell:**

```powershell
.\scripts\deploy.ps1
```

## Important: Use `reload` NOT `restart`

### ✅ Correct (Zero-Downtime)

```bash
pm2 reload ecosystem.config.js
# or
npm run pm2:reload
```

### ❌ Wrong (Causes Downtime)

```bash
pm2 restart ecosystem.config.js  # Stops all instances first!
pm2 stop ecosystem.config.js     # Causes downtime
```

## How It Works Step-by-Step

### 1. Build Phase

```bash
npm run build
```

- Compiles TypeScript to JavaScript
- Creates `dist/` folder with production code

### 2. Reload Phase

```bash
pm2 reload ecosystem.config.js
```

**What happens:**

1. PM2 reads the new `dist/main.js`
2. Starts new instances (one by one)
3. Each new instance:
   - Connects to Redis queue
   - Starts worker
   - Signals readiness: `process.send('ready')`
   - Starts accepting HTTP connections
4. PM2 routes new traffic to new instances
5. Old instances:
   - Stop accepting new connections
   - Finish current HTTP requests
   - Workers finish current jobs (up to 30s)
   - Close gracefully

### 3. Result

- ✅ No HTTP connection loss
- ✅ No job loss (jobs in Redis)
- ✅ Current jobs finish processing
- ✅ New code is live

## Graceful Shutdown Sequence

When PM2 sends `SIGTERM` to an instance:

1. **HTTP Server**: Stops accepting new connections
2. **Current Requests**: Finish processing
3. **Worker**: Finishes current jobs (30s timeout)
4. **Redis**: Connections close gracefully
5. **Process**: Exits cleanly

## Configuration Details

### PM2 Configuration (`ecosystem.config.js`)

```javascript
{
  kill_timeout: 30000,        // Wait 30s for graceful shutdown
  wait_ready: true,           // Wait for app readiness signal
  listen_timeout: 10000,      // Wait 10s for app to start
  shutdown_with_message: true // Enable graceful shutdown
}
```

### Application Configuration

**main.ts:**

- Sends `process.send('ready')` when ready
- Listens for `SIGTERM`/`SIGINT`
- Closes HTTP server gracefully

**worker.service.ts:**

- `worker.close(30000)` waits for jobs to finish
- Graceful shutdown in `onModuleDestroy`

## Monitoring Deployment

### During Deployment

```bash
# Watch logs in real-time
pm2 logs group-backend --lines 50

# Monitor resources
pm2 monit

# Check status
pm2 status
```

### What to Look For

**Good signs:**

- New instances start: `Worker "mensagens-worker-X" started`
- Old instances stop: `Worker stopped gracefully`
- No errors in logs
- HTTP requests continue to work

**Warning signs:**

- Jobs stuck in processing (check Redis)
- HTTP errors (check if instances are ready)
- Worker errors (check Redis connection)

## Troubleshooting

### Jobs Not Processing After Reload

1. **Check workers started:**

   ```bash
   pm2 logs group-backend | grep "Worker.*started"
   ```

2. **Check Redis connection:**

   ```bash
   redis-cli ping
   ```

3. **Check queue status:**
   ```bash
   curl http://localhost:7777/queue/status
   ```

### HTTP Connections Dropping

1. **Verify reload (not restart):**

   ```bash
   pm2 reload ecosystem.config.js  # Correct
   ```

2. **Check instance readiness:**

   ```bash
   pm2 logs group-backend | grep "ready"
   ```

3. **Verify all instances running:**
   ```bash
   pm2 status
   ```

### Long-Running Jobs

If jobs take longer than 30 seconds:

1. **Increase timeout** in `ecosystem.config.js`:

   ```javascript
   kill_timeout: 60000, // 60 seconds
   ```

2. **Increase worker close timeout** in `worker.service.ts`:
   ```typescript
   await this.worker.close(60000); // 60 seconds
   ```

## Best Practices

1. **Always use `reload`** for deployments (not `restart`)
2. **Test builds** before deploying to production
3. **Monitor logs** during deployment
4. **Deploy during low traffic** if possible (though not required)
5. **Keep Redis stable** - it's the single point of coordination
6. **Monitor queue depth** - ensure jobs aren't backing up

## Example Deployment Workflow

```bash
# 1. Make code changes
# ... edit files ...

# 2. Test locally (optional)
npm run start:dev

# 3. Deploy to production (zero-downtime)
npm run deploy

# 4. Monitor
pm2 logs group-backend --lines 100

# 5. Verify
curl http://localhost:7777/queue/status
```

## Rollback

If something goes wrong:

```bash
# 1. Revert code changes
git checkout previous-commit

# 2. Rebuild and reload
npm run deploy

# Or restore from backup
pm2 restart ecosystem.config.js  # Only if necessary
```

## Summary

- ✅ **Use `pm2 reload`** for zero-downtime deployments
- ✅ **Jobs are safe** - stored in Redis, not lost
- ✅ **HTTP connections** - PM2 handles migration
- ✅ **Workers finish jobs** - graceful shutdown with timeout
- ✅ **Multiple instances** - at least one always serving

Your application is now configured for zero-downtime deployments! 🚀
