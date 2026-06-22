CREATE TABLE IF NOT EXISTS "PlatformSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ('backgroundVideoUrl', '/videos/come-to-barbados.mp4', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
