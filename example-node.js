import Redis from 'ioredis';
import { Queue, Worker } from 'groupmq';

const redis = new Redis('redis://127.0.0.1:6379');

function logTimeBR(label) {
  const time = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
  });
  console.log(`[${time}] ${label}`);
}

// How many groups to process in parallel (each group = subqueue, one job at a time per group)
const NUM_GROUPS = Number(process.env.NUM_GROUPS) || 3000;

const queue = new Queue({
  redis,
  namespace: 'teste_9',
  jobTimeoutMs: 600_000, // Max 10 min - must be >= longest job timeoutMs
  // Must be >= NUM_GROUPS so reserve() can see all groups (default 20 caps at ~28 jobs with 100 groups)
  reserveScanLimit: Math.max(NUM_GROUPS, 100),
});

// Per-job timeoutMs: each job declares how long it can run. On restart, stalled check
// uses startedAt + timeoutMs so the job "finishes" at the correct time (no reset).
// Only add jobs when queue is empty (skip on restart so we process existing jobs)
const counts = await queue.getJobCounts();
const hasJobs =
  (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0) > 0;
if (!hasJobs) {
  const groupIds = Array.from(
    { length: NUM_GROUPS },
    (_, i) => `user:${i + 1}`,
  );
  for (const groupId of groupIds) {
    await queue.add({
      groupId,
      data: { type: `${groupId}_job1`, amount: 999, timeoutMs: 30_000 }, // 30s
    });
    await queue.add({
      groupId,
      data: { type: `${groupId}_job2`, amount: 888, timeoutMs: 20_000 },
    });
    await queue.add({
      groupId,
      data: { type: `${groupId}_job3`, amount: 777 }, // No timeout = run immediately
    });
  }
  logTimeBR(
    `Added job1, job2, job3 for ${NUM_GROUPS} groups (${groupIds.join(', ')})`,
  );
} else {
  logTimeBR(
    `Queue has existing jobs (waiting: ${counts.waiting}, active: ${counts.active}) - processing them`,
  );
}

const worker = new Worker({
  queue,
  concurrency: NUM_GROUPS, // Process all groups in parallel (one job per group at a time)
  stalledInterval: 0, // Disabled - we use our own check to avoid circuit breaker race
  stalledGracePeriod: 0,
  maxStalledCount: 1, // Fail stalled job so group unblocks and next job can run
  handler: async (job) => {
    logTimeBR(`START: ${job.data.type}`);
    // timeoutMs: job-specific. undefined/null = run immediately (no wait)
    const timeoutMs = job.data.timeoutMs ?? 0;

    // Store startedAt so stalled check can compute per-job deadline on restart
    const jobKey = `${queue.namespace}:job:${job.id}`;
    await redis.hsetnx(jobKey, 'startedAt', String(Date.now()));

    // Mock work - 0 = run immediately, >0 = wait that long
    console.log(`start ${job.data.type} (timeout ${timeoutMs}ms)`);
    if (timeoutMs > 0) {
      await new Promise((rs) => setTimeout(rs, timeoutMs));
    }
    console.log(`end ${job.data.type}`);
    logTimeBR(
      `END: ${job.data.type} (${timeoutMs > 0 ? timeoutMs + 'ms elapsed' : 'immediate'})`,
    );

    return { ok: true };
  },
});

// Library events - see how groupmq signals job lifecycle
worker.on('completed', (job) => {
  logTimeBR(`[worker] COMPLETED: ${job.data?.type} (handler finished ok)`);
});

worker.on('failed', (job) => {
  logTimeBR(
    `[worker] FAILED: ${job.data?.type} - ${job.failedReason || 'unknown'}`,
  );
});

worker.on('stalled', (jobId, groupId) => {
  logTimeBR(
    `[worker] STALLED: job ${jobId} from group ${groupId} (recovered or marked failed by library)`,
  );
});

// Custom stalled check: use per-job timeoutMs + startedAt so timeouts don't reset on restart.
// E.g. job with 4min timeout started at 13:02:05 → finishes at 13:06:05 even after restart.
async function checkStalledWithPerJobTimeout() {
  const now = Date.now();
  const ns = queue.namespace;
  const r = queue.redis;
  const processingKey = `${ns}:processing`;

  const jobs = await r.zrange(processingKey, 0, -1, 'WITHSCORES');
  if (jobs.length > 0) {
    logTimeBR(`[stalled check] ${jobs.length / 2} job(s) in processing`);
  }
  const groupsKey = `${ns}:groups`;
  const readyKey = `${ns}:ready`;
  const groupsToUnblock = [];

  for (let i = 0; i < jobs.length; i += 2) {
    const jobId = jobs[i];
    const currentScore = Number(jobs[i + 1]);
    const jobKey = `${ns}:job:${jobId}`;
    const [dataRaw, startedAtRaw, groupIdRaw] = await r.hmget(
      jobKey,
      'data',
      'startedAt',
      'groupId',
    );
    const groupId = groupIdRaw || null;
    const startedAt = startedAtRaw ? Number(startedAtRaw) : null;
    const DEFAULT_TIMEOUT_MS = 0; // No timeout = recover immediately on restart
    let timeoutMs = DEFAULT_TIMEOUT_MS;
    let jobType = 'job';
    try {
      const data = dataRaw ? JSON.parse(dataRaw) : {};
      timeoutMs = data.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      jobType = data.type ?? jobId;
    } catch {}

    let shouldRecover = false;
    if (startedAt != null) {
      const correctDeadline = startedAt + (timeoutMs ?? 0);
      if (now >= correctDeadline) {
        shouldRecover = true;
        const elapsed = Math.round((now - startedAt) / 1000);
        logTimeBR(
          `END: ${jobType} (timed out after restart - ${elapsed}s elapsed, ran at correct time)`,
        );
        logTimeBR(`COMPLETED: ${jobType} (timed out - ran at correct time)`);
        logTimeBR(
          timeoutMs > 0
            ? `[stalled check] Recovering job ${jobId} (timeout: startedAt + ${timeoutMs}ms)`
            : `[stalled check] Recovering job ${jobId} (no timeout - immediate)`,
        );
      }
    } else if (startedAt == null && now >= currentScore) {
      shouldRecover = true;
      logTimeBR(`END: ${jobType} (timed out - no startedAt, deadline passed)`);
      logTimeBR(`COMPLETED: ${jobType} (timed out - deadline passed)`);
      logTimeBR(
        `[stalled check] Recovering job ${jobId} (no startedAt, deadline passed)`,
      );
    }
    if (shouldRecover && groupId) {
      await r.zadd(processingKey, 0, jobId); // Mark so checkStalledJobs finds it
      groupsToUnblock.push(groupId);
    }
  }

  const results = await queue.checkStalledJobs(now, 0, 1);

  // Add group to ready so job2/job3 run. Do this when WE marked jobs for recovery,
  // because checkStalledJobs may return [] due to circuit breaker (worker ran first).
  for (const groupId of groupsToUnblock) {
    const groupKey = `${ns}:g:${groupId}`;
    const head = await r.zrange(groupKey, 0, 0, 'WITHSCORES');
    if (head && head.length >= 2) {
      const headScore = head[1];
      await r.zadd(readyKey, headScore, groupId);
      await r.sadd(groupsKey, groupId);
      logTimeBR(
        `[stalled check] Group ${groupId} re-added to ready (next job can run)`,
      );
    } else {
      logTimeBR(
        `[stalled check] Job timed out - group ${groupId} has no more jobs (queue empty)`,
      );
    }
  }

  // Also handle results from checkStalledJobs (in case we ran first and circuit breaker wasn't hit)
  for (let i = 0; i < results.length; i += 3) {
    const groupId = results[i + 1];
    const action = results[i + 2];
    if (action === 'failed' && groupId && !groupsToUnblock.includes(groupId)) {
      const groupKey = `${ns}:g:${groupId}`;
      const head = await r.zrange(groupKey, 0, 0, 'WITHSCORES');
      if (head && head.length >= 2) {
        const headScore = head[1];
        await r.zadd(readyKey, headScore, groupId);
        await r.sadd(groupsKey, groupId);
        logTimeBR(
          `[stalled check] Group ${groupId} re-added to ready (from checkStalledJobs)`,
        );
      }
    }
  }
  return results;
}

// Run stalled check immediately on startup - if deadline already passed, recover right away
const stalled = await checkStalledWithPerJobTimeout();
if (stalled.length > 0) {
  logTimeBR(
    `Recovered ${stalled.length / 3} stalled job(s) from previous process`,
  );
}

// Run custom stalled check every 2s - recovers within ~2s of deadline
const stalledCheckInterval = setInterval(checkStalledWithPerJobTimeout, 2_000);

worker.run();
logTimeBR(
  `Worker started - ${NUM_GROUPS} groups, concurrency ${NUM_GROUPS} (3 jobs per group)`,
);

// Graceful shutdown: stop immediately so job stays in Redis with its deadline
// On next restart, stalled check will recover it at the correct time
async function shutdown() {
  logTimeBR('Shutting down (timeouts persist in Redis)...');
  clearInterval(stalledCheckInterval);
  await worker.close(0); // Don't wait - job stays in processing, will be recovered on restart
  redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
