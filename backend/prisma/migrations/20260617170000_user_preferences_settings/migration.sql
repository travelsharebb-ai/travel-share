CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultLocationVisibility" "LocationVisibility" NOT NULL DEFAULT 'approximate',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "uploadAlerts" BOOLEAN NOT NULL DEFAULT true,
    "promotionalEmails" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
