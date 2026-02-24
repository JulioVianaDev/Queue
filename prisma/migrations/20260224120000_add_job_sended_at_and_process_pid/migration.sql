-- AlterTable: add jobSendedAt (when job was enqueued) and processPid (Nest process that processed the message)
ALTER TABLE "processed_messages" ADD COLUMN IF NOT EXISTS "jobSendedAt" TIMESTAMP(3);
ALTER TABLE "processed_messages" ADD COLUMN IF NOT EXISTS "processPid" INTEGER;
