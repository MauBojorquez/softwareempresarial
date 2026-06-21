-- CreateTable
CREATE TABLE "CashFlowAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CashFlowAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowTransaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bankReference" TEXT,
    "movementType" TEXT,
    "deposit" DOUBLE PRECISION,
    "withdrawal" DOUBLE PRECISION,
    "concept" TEXT,
    "provider" TEXT,
    "reference" TEXT,
    "invoiceUuid" TEXT,
    "taxRate" DOUBLE PRECISION,
    "salesType" TEXT,
    "incomeCategories" JSONB,
    "expenseCategories" JSONB,
    "notes" TEXT,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "CashFlowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'both',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CashFlowCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashFlowAccount_organizationId_order_idx" ON "CashFlowAccount"("organizationId", "order");

-- CreateIndex
CREATE INDEX "CashFlowTransaction_accountId_date_idx" ON "CashFlowTransaction"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CashFlowCategory_organizationId_code_key" ON "CashFlowCategory"("organizationId", "code");

-- CreateIndex
CREATE INDEX "CashFlowCategory_organizationId_order_idx" ON "CashFlowCategory"("organizationId", "order");

-- AddForeignKey
ALTER TABLE "CashFlowAccount" ADD CONSTRAINT "CashFlowAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowTransaction" ADD CONSTRAINT "CashFlowTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CashFlowAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowCategory" ADD CONSTRAINT "CashFlowCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
