-- CreateTable
CREATE TABLE "processed_messages" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "messageData" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_messages_jobId_key" ON "processed_messages"("jobId");

-- CreateIndex
CREATE INDEX "processed_messages_groupId_idx" ON "processed_messages"("groupId");

-- CreateIndex
CREATE INDEX "processed_messages_instanceId_customerId_idx" ON "processed_messages"("instanceId", "customerId");

-- CreateIndex
CREATE INDEX "processed_messages_processedAt_idx" ON "processed_messages"("processedAt");
