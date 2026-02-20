-- AlterTable
ALTER TABLE "Content" ADD COLUMN "previewPath" TEXT;

-- CreateTable
CREATE TABLE "ShortSlug" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortSlug_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortSlug_slug_key" ON "ShortSlug"("slug");
