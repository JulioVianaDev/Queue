# PM2 Cluster Setup Guide

This guide explains how to run multiple instances of the backend with PM2 clusters while safely using GroupMQ queues and workers.

## How It Works

### Queue Instances (Safe)
- **Multiple instances can safely create Queue instances with the same namespace**
- All instances connect to the same Redis backend
- Jobs are stored in Redis, not in memory
- Adding jobs from any instance works correctly

### Workers (Coordinated)
- Each instance runs its own worker
- Workers coordinate through Redis locks
- **Jobs are never processed twice** - Redis ensures atomic job reservation
- Workers from different instances process jobs in parallel
- Per-group FIFO ordering is maintained across all instances

### Example Scenario
```
Instance 1 (PM2 ID: 0) → Worker: mensagens-worker-0
Instance 2 (PM2 ID: 1) → Worker: mensagens-worker-1
Instance 3 (PM2 ID: 2) → Worker: mensagens-worker-2
Instance 4 (PM2 ID: 3) → Worker: mensagens-worker-3

All workers process jobs from the same Redis queue "mensagens"
Jobs are distributed across workers automatically
No job is processed twice
```

## Setup

### 1. Build the Application
```bash
npm run build
```

### 2. Create Logs Directory
```bash
mkdir logs
```

### 3. Start with PM2
```bash
# Start all instances
pm2 start ecosystem.config.js

# Or start with specific number of instances
pm2 start ecosystem.config.js --instances 4
```

### 4. Monitor
```bash
# View logs from all instances
pm2 logs

# View specific instance logs
pm2 logs group-backend --lines 100

# Monitor resources
pm2 monit

# View status
pm2 status

# View detailed info
pm2 describe group-backend
```

### 5. Management Commands
```bash
# Restart all instances
pm2 restart all

# Stop all instances
pm2 stop all

# Reload (zero-downtime restart)
pm2 reload all

# Delete all instances
pm2 delete all

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
pm2 save
```

## Configuration

### Environment Variables

Edit `ecosystem.config.js` to customize:

- **instances**: Number of instances (or 'max' for all CPU cores)
- **WORKER_CONCURRENCY**: Jobs processed concurrently per worker (default: 5)
- **REDIS_HOST**: Redis server host
- **REDIS_PORT**: Redis server port
- **PORT**: Application port (all instances use the same port with cluster mode)

### Example: 4 Instances, 10 Concurrent Jobs Each

```javascript
instances: 4,
env: {
  WORKER_CONCURRENCY: '10',
  // ... other vars
}
```

**Total capacity**: 4 instances × 10 concurrent jobs = 40 jobs processed simultaneously

## How Jobs Are Distributed

1. **Job Added**: Any instance can add a job to the queue
2. **Job Reservation**: Workers from any instance can reserve jobs
3. **Atomic Lock**: Redis ensures only one worker gets each job
4. **Processing**: Worker processes the job
5. **Completion**: Job is marked complete, next job from same group can be processed

### Group FIFO Guarantee

Jobs with the same `instanceId:customerId` are always processed in FIFO order, even across multiple instances:

```
Group: instance-123:customer-456
Job 1 → Instance 2 processes
Job 2 → Instance 1 processes (waits for Job 1 to complete)
Job 3 → Instance 3 processes (waits for Job 2 to complete)
```

## Monitoring

### Dashboard
Access the Bull Board dashboard at: `http://localhost:7777/admin/queues`

The dashboard shows:
- All jobs across all instances
- Active workers (you'll see multiple workers processing)
- Queue statistics

### Logs
Each instance logs with its PM2 ID:
```
[WorkerService] Worker "mensagens-worker-0" started (Instance: 0)
[WorkerService] Worker "mensagens-worker-1" started (Instance: 1)
```

### PM2 Metrics
```bash
pm2 monit  # Real-time CPU, memory, logs
```

## Troubleshooting

### Jobs Not Processing
- Check Redis connection: `redis-cli ping`
- Check worker logs: `pm2 logs group-backend`
- Verify workers started: Look for "Worker started" in logs

### High Memory Usage
- Reduce `WORKER_CONCURRENCY` per instance
- Reduce number of instances
- Check for memory leaks in job handlers

### Jobs Processed Twice
- This should never happen - GroupMQ uses Redis locks
- If it does, check Redis connection stability
- Verify only one Redis instance is being used

### Worker Not Starting
- Check Redis is accessible from all instances
- Verify environment variables are set correctly
- Check PM2 logs for errors

## Best Practices

1. **Start with fewer instances** and scale up based on load
2. **Monitor Redis memory** - queues can grow if jobs aren't processed
3. **Set appropriate concurrency** - balance throughput vs resource usage
4. **Use graceful shutdown** - PM2 waits for jobs to complete (30s timeout)
5. **Monitor logs** - each instance logs its PM2 ID for identification

## Scaling

### Horizontal Scaling (More Instances)
```bash
# Scale to 8 instances
pm2 scale group-backend 8
```

### Vertical Scaling (More Concurrency)
Edit `ecosystem.config.js`:
```javascript
WORKER_CONCURRENCY: '10'  // Increase from 5 to 10
```

### Both
Run 8 instances with 10 concurrency each = 80 concurrent jobs

