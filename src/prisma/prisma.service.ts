import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * PrismaService with a pg Pool so connections are recycled before PostgreSQL
 * closes them (avoids P1017 "Server has closed the connection" in multi-process).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/group_queue?schema=public';

    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 20_000, // Recycle connections before server closes them
      connectionTimeoutMillis: 10_000,
    });

    const adapter = new PrismaPg(pool, { disposeExternalPool: false });

    super({ adapter });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
// @Injectable()
// export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
//   private readonly logger = new Logger(PrismaService.name);

//   constructor() {
//     super({
//       log: ['error', 'warn'],
//     });
//   }

//   async onModuleInit() {
//     try {
//       await this.$connect();
//       this.logger.log('Prisma connected to database');
//     } catch (error) {
//       this.logger.error('Failed to connect to database', error);
//       throw error;
//     }
//   }

//   async onModuleDestroy() {
//     await this.$disconnect();
//     this.logger.log('Prisma disconnected from database');
//   }
// }
