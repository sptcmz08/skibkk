ALTER TABLE "booking_items"
ADD COLUMN "customerRescheduledAt" TIMESTAMP(3),
ADD COLUMN "customerOriginalDate" DATE,
ADD COLUMN "customerOriginalStartTime" TEXT,
ADD COLUMN "customerOriginalEndTime" TEXT;
