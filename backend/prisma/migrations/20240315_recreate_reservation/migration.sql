-- Drop existing tables and their dependencies
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "Fichier" CASCADE;
DROP TABLE IF EXISTS "Expense" CASCADE;
DROP TABLE IF EXISTS "Reservation" CASCADE;
DROP TYPE IF EXISTS "RoomType" CASCADE;
DROP TYPE IF EXISTS "Status" CASCADE;

-- Recreate types
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD');
CREATE TYPE "Status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- Recreate Reservation table with new structure
CREATE TABLE "Reservation" (
    "id" SERIAL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "programId" INTEGER NOT NULL REFERENCES "Program"("id"),
    "roomType" "RoomType" NOT NULL,
    "hotelMadina" TEXT,
    "hotelMakkah" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Incomplet',
    "statutPasseport" BOOLEAN NOT NULL DEFAULT false,
    "statutVisa" BOOLEAN NOT NULL DEFAULT false,
    "statutHotel" BOOLEAN NOT NULL DEFAULT false,
    "statutVol" BOOLEAN NOT NULL DEFAULT false,
    "reservationDate" TIMESTAMP NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Recreate Fichier table
CREATE TABLE "Fichier" (
    "id" SERIAL PRIMARY KEY,
    "reservationId" INTEGER NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Recreate Payment table
CREATE TABLE "Payment" (
    "id" SERIAL PRIMARY KEY,
    "reservationId" INTEGER NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fichierId" INTEGER UNIQUE REFERENCES "Fichier"("id")
);

-- Recreate Expense table
CREATE TABLE "Expense" (
    "id" SERIAL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "programId" INTEGER REFERENCES "Program"("id") ON DELETE SET NULL,
    "reservationId" INTEGER REFERENCES "Reservation"("id") ON DELETE SET NULL
); 