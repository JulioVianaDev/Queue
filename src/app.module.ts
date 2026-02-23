import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueueModule } from './queue/queue.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
