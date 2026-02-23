/**
 * PM2 Ecosystem Configuration
 *
 * This configuration allows running multiple instances of the application
 * in cluster mode. Each instance will:
 * - Share the same Redis queue (safe - GroupMQ coordinates through Redis)
 * - Run its own worker (workers coordinate through Redis locks)
 * - Process jobs in parallel across instances
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */
module.exports = {
  apps: [
    {
      name: 'group-backend',
      script: 'dist/src/main.js',
      instances: 2, // Number of processes (use 'max' for all CPU cores, or a number like 4)
      exec_mode: 'cluster', // Cluster mode for load balancing
      env_file: '.env', // 👈 add this
      env: {
        NODE_ENV: 'production', // these still override .env values
      },
      // PM2 will set pm_id automatically for each instance
      // This is used to identify workers in logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown - wait for workers to finish current jobs
      kill_timeout: 30000, // 30 seconds - time to wait for graceful shutdown
      wait_ready: true, // Wait for app to signal readiness (process.send('ready'))
      listen_timeout: 10000, // Time to wait for app to start listening
      shutdown_with_message: true, // Enable graceful shutdown with message
      // Zero-downtime reload configuration
      instance_var: 'INSTANCE_ID', // Environment variable for instance ID
      // Auto restart on crash
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Memory limit (restart if exceeded)
      max_memory_restart: '500M',
    },
  ],
};
