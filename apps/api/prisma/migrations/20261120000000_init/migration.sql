-- CreateTable
CREATE TABLE `Tenant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'EGP',
    `defaultTaxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `User_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `family` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    INDEX `RefreshToken_family_idx`(`family`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `Category_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `categoryId` INTEGER NULL,
    `sku` VARCHAR(60) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `unit` VARCHAR(30) NOT NULL DEFAULT 'piece',
    `costPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `salePrice` DECIMAL(14, 2) NOT NULL,
    `stockQty` INTEGER NOT NULL DEFAULT 0,
    `reorderLevel` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Product_tenantId_name_idx`(`tenantId`, `name`),
    INDEX `Product_tenantId_isActive_idx`(`tenantId`, `isActive`),
    UNIQUE INDEX `Product_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `Product_tenantId_sku_key`(`tenantId`, `sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `type` ENUM('OPENING', 'SALE', 'SALE_CANCEL', 'PURCHASE_RECEIPT', 'ADJUSTMENT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `refType` VARCHAR(30) NULL,
    `refId` INTEGER NULL,
    `note` VARCHAR(255) NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockMovement_tenantId_productId_createdAt_idx`(`tenantId`, `productId`, `createdAt`),
    INDEX `StockMovement_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(190) NULL,
    `address` VARCHAR(255) NULL,
    `taxNumber` VARCHAR(60) NULL,
    `creditLimit` DECIMAL(14, 2) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_tenantId_name_idx`(`tenantId`, `name`),
    UNIQUE INDEX `Customer_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerPrice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `price` DECIMAL(14, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomerPrice_tenantId_customerId_productId_key`(`tenantId`, `customerId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(190) NULL,
    `address` VARCHAR(255) NULL,
    `taxNumber` VARCHAR(60) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Supplier_tenantId_name_idx`(`tenantId`, `name`),
    UNIQUE INDEX `Supplier_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `number` VARCHAR(30) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdById` INTEGER NOT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SalesOrder_tenantId_customerId_status_idx`(`tenantId`, `customerId`, `status`),
    INDEX `SalesOrder_tenantId_status_confirmedAt_idx`(`tenantId`, `status`, `confirmedAt`),
    UNIQUE INDEX `SalesOrder_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `SalesOrder_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `salesOrderId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(160) NOT NULL,
    `sku` VARCHAR(60) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(14, 2) NOT NULL,
    `unitCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(14, 2) NOT NULL,

    INDEX `SalesOrderItem_tenantId_productId_idx`(`tenantId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `number` VARCHAR(30) NOT NULL,
    `supplierId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedDate` DATETIME(3) NULL,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdById` INTEGER NOT NULL,
    `orderedAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PurchaseOrder_tenantId_supplierId_status_idx`(`tenantId`, `supplierId`, `status`),
    UNIQUE INDEX `PurchaseOrder_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `PurchaseOrder_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `purchaseOrderId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(160) NOT NULL,
    `sku` VARCHAR(60) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitCost` DECIMAL(14, 2) NOT NULL,
    `lineTotal` DECIMAL(14, 2) NOT NULL,

    INDEX `PurchaseOrderItem_tenantId_productId_idx`(`tenantId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `salesOrderId` INTEGER NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER') NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `reference` VARCHAR(100) NULL,
    `notes` VARCHAR(255) NULL,
    `createdById` INTEGER NOT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` INTEGER NULL,
    `voidReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerPayment_tenantId_customerId_paidAt_idx`(`tenantId`, `customerId`, `paidAt`),
    INDEX `CustomerPayment_tenantId_paidAt_idx`(`tenantId`, `paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `supplierId` INTEGER NOT NULL,
    `purchaseOrderId` INTEGER NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER') NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `reference` VARCHAR(100) NULL,
    `notes` VARCHAR(255) NULL,
    `createdById` INTEGER NOT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` INTEGER NULL,
    `voidReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupplierPayment_tenantId_supplierId_paidAt_idx`(`tenantId`, `supplierId`, `paidAt`),
    INDEX `SupplierPayment_tenantId_paidAt_idx`(`tenantId`, `paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentSequence` (
    `tenantId` INTEGER NOT NULL,
    `docType` ENUM('SALES_ORDER', 'PURCHASE_ORDER') NOT NULL,
    `nextValue` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`tenantId`, `docType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `action` VARCHAR(60) NOT NULL,
    `entityType` VARCHAR(40) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_tenantId_productId_fkey` FOREIGN KEY (`tenantId`, `productId`) REFERENCES `Product`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPrice` ADD CONSTRAINT `CustomerPrice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPrice` ADD CONSTRAINT `CustomerPrice_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPrice` ADD CONSTRAINT `CustomerPrice_tenantId_productId_fkey` FOREIGN KEY (`tenantId`, `productId`) REFERENCES `Product`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_tenantId_salesOrderId_fkey` FOREIGN KEY (`tenantId`, `salesOrderId`) REFERENCES `SalesOrder`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_tenantId_productId_fkey` FOREIGN KEY (`tenantId`, `productId`) REFERENCES `Product`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_tenantId_supplierId_fkey` FOREIGN KEY (`tenantId`, `supplierId`) REFERENCES `Supplier`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_tenantId_purchaseOrderId_fkey` FOREIGN KEY (`tenantId`, `purchaseOrderId`) REFERENCES `PurchaseOrder`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_tenantId_productId_fkey` FOREIGN KEY (`tenantId`, `productId`) REFERENCES `Product`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_tenantId_supplierId_fkey` FOREIGN KEY (`tenantId`, `supplierId`) REFERENCES `Supplier`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentSequence` ADD CONSTRAINT `DocumentSequence_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity guarantees Prisma's schema language cannot express (MySQL 8.0.16+ enforces CHECK).
ALTER TABLE `Product` ADD CONSTRAINT `Product_stockQty_nonneg` CHECK (`stockQty` >= 0);
ALTER TABLE `Product` ADD CONSTRAINT `Product_prices_nonneg` CHECK (`costPrice` >= 0 AND `salePrice` >= 0);
ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_quantity_pos` CHECK (`quantity` > 0);
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_quantity_pos` CHECK (`quantity` > 0);
ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_amount_pos` CHECK (`amount` > 0);
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_amount_pos` CHECK (`amount` > 0);
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_amounts_nonneg` CHECK (`discount` >= 0 AND `discount` <= `subtotal` AND `total` >= 0);
