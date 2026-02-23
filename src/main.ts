import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DashboardService } from './queue/services/dashboard.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the dashboard service and set up the route
  const dashboardService = app.get(DashboardService);
  app.use(dashboardService.getBasePath(), dashboardService.getRouter());

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 7777;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Bull Board Dashboard is available at: http://localhost:${port}${dashboardService.getBasePath()}`,
  );

  // Signal PM2 that the application is ready (for wait_ready)
  // This enables zero-downtime reloads
  if (process.send) {
    process.send('ready');
  }

  // Handle graceful shutdown signals
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop accepting new connections
      await app.close();
      console.log('HTTP server closed, exiting...');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap();
