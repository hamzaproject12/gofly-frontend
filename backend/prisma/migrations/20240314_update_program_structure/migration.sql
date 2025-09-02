-- Drop existing tables and types
DROP TABLE IF EXISTS "Expense" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "Fichier" CASCADE;
DROP TABLE IF EXISTS "Reservation" CASCADE;
DROP TABLE IF EXISTS "Hotel" CASCADE;
DROP TABLE IF EXISTS "Program" CASCADE;
DROP TYPE IF EXISTS "RoomType" CASCADE;
DROP TYPE IF EXISTS "Status" CASCADE;
DROP TYPE IF EXISTS "City" CASCADE;

-- Create types
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD');
CREATE TYPE "Status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "City" AS ENUM ('Madina', 'Makkah');

-- Create Program table
CREATE TABLE "Program" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "visaDeadline" DATE,
    "hotelDeadline" DATE,
    "flightDeadline" DATE
);

-- Create Hotel table
CREATE TABLE "Hotel" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(150) NOT NULL,
    "city" "City" NOT NULL,
    "programId" INTEGER REFERENCES "Program"("id")
);

-- Create Reservation table
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
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "reservationDate" TIMESTAMP NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Create Fichier table
CREATE TABLE "Fichier" (
    "id" SERIAL PRIMARY KEY,
    "reservationId" INTEGER NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP DEFAULT NOW()
);

-- Create Payment table
CREATE TABLE "Payment" (
    "id" SERIAL PRIMARY KEY,
    "reservationId" INTEGER NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP DEFAULT NOW(),
    "fichierId" INTEGER UNIQUE REFERENCES "Fichier"("id")
);

-- Create Expense table
CREATE TABLE "Expense" (
    "id" SERIAL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP DEFAULT NOW(),
    "programId" INTEGER REFERENCES "Program"("id"),
    "reservationId" INTEGER REFERENCES "Reservation"("id")
);

-- Insert some default hotels
INSERT INTO "Hotel" (name, city) VALUES
('Groupe Imane', 'Madina'),
('Shaza Regency', 'Madina'),
('Borj Al Deafah', 'Makkah'),
('Emaar Grand', 'Makkah'),
('Al Shohada', 'Makkah'),
('Swissôtel Al Maqam', 'Makkah'),
('Meezab Al Biban', 'Makkah'),
('Abraj al Tayseer', 'Makkah'),
('SAMA AL-KHAIR', 'Makkah'); 