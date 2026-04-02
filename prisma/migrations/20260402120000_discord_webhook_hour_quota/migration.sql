-- CreateTable
CREATE TABLE "DiscordWebhookHourQuota" (
    "hourBucketUtc" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0
);
