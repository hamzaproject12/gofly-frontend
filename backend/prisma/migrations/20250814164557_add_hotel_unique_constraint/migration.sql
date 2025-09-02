/*
  Warnings:

  - A unique constraint covering the columns `[name,city]` on the table `Hotel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Hotel_name_city_key" ON "Hotel"("name", "city");
