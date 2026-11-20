BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[Tenant] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(120) NOT NULL,
    [currency] CHAR(3) NOT NULL CONSTRAINT [Tenant_currency_df] DEFAULT 'EGP',
    [defaultTaxRate] DECIMAL(5,2) NOT NULL CONSTRAINT [Tenant_defaultTaxRate_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Tenant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Tenant_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [email] NVARCHAR(190) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(20) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'STAFF',
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [User_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId],[id])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshToken] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [tokenHash] CHAR(64) NOT NULL,
    [family] CHAR(36) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RefreshToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RefreshToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Category] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Category_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Category_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId],[id]),
    CONSTRAINT [Category_tenantId_name_key] UNIQUE NONCLUSTERED ([tenantId],[name])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [categoryId] INT,
    [sku] NVARCHAR(60) NOT NULL,
    [name] NVARCHAR(160) NOT NULL,
    [unit] NVARCHAR(30) NOT NULL CONSTRAINT [Product_unit_df] DEFAULT 'piece',
    [costPrice] DECIMAL(14,2) NOT NULL CONSTRAINT [Product_costPrice_df] DEFAULT 0,
    [salePrice] DECIMAL(14,2) NOT NULL,
    [stockQty] INT NOT NULL CONSTRAINT [Product_stockQty_df] DEFAULT 0,
    [reorderLevel] INT NOT NULL CONSTRAINT [Product_reorderLevel_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Product_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Product_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Product_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId],[id]),
    CONSTRAINT [Product_tenantId_sku_key] UNIQUE NONCLUSTERED ([tenantId],[sku])
);

-- CreateTable
CREATE TABLE [dbo].[StockMovement] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [productId] INT NOT NULL,
    [type] NVARCHAR(20) NOT NULL,
    [quantity] INT NOT NULL,
    [balanceAfter] INT NOT NULL,
    [refType] NVARCHAR(30),
    [refId] INT,
    [note] NVARCHAR(255),
    [userId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StockMovement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [StockMovement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Customer] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [name] NVARCHAR(160) NOT NULL,
    [phone] NVARCHAR(40),
    [email] NVARCHAR(190),
    [address] NVARCHAR(255),
    [taxNumber] NVARCHAR(60),
    [creditLimit] DECIMAL(14,2),
    [notes] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [Customer_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Customer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Customer_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Customer_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId],[id])
);

-- CreateTable
CREATE TABLE [dbo].[CustomerPrice] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [customerId] INT NOT NULL,
    [productId] INT NOT NULL,
    [price] DECIMAL(14,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CustomerPrice_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CustomerPrice_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CustomerPrice_tenantId_customerId_productId_key] UNIQUE NONCLUSTERED ([tenantId],[customerId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[Supplier] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [name] NVARCHAR(160) NOT NULL,
    [phone] NVARCHAR(40),
    [email] NVARCHAR(190),
    [address] NVARCHAR(255),
    [taxNumber] NVARCHAR(60),
    [notes] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [Supplier_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Supplier_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Supplier_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Supplier_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId],[id])
);

-- CreateTable
CREATE TABLE [dbo].[SalesOrder] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [number] NVARCHAR(30) NOT NULL,
    [customerId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [SalesOrder_status_df] DEFAULT 'DRAFT',
    [orderDate] DATETIME2 NOT NULL CONSTRAINT [SalesOrder_orderDate_df] DEFAULT CURRENT_TIMESTAMP,
    [subtotal] DECIMAL(14,2) NOT NULL CONSTRAINT [SalesOrder_subtotal_df] DEFAULT 0,
    [discount] DECIMAL(14,2) NOT NULL CONSTRAINT [SalesOrder_discount_df] DEFAULT 0,
    [taxRate] DECIMAL(5,2) NOT NULL CONSTRAINT [SalesOrder_taxRate_df] DEFAULT 0,
    [taxAmount] DECIMAL(14,2) NOT NULL CONSTRAINT [SalesOrder_taxAmount_df] DEFAULT 0,
    [total] DECIMAL(14,2) NOT NULL CONSTRAINT [SalesOrder_total_df] DEFAULT 0,
    [notes] NVARCHAR(max),
    [createdById] INT NOT NULL,
    [confirmedAt] DATETIME2,
    [deliveredAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SalesOrder_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SalesOrder_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalesOrder_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId],[id]),
    CONSTRAINT [SalesOrder_tenantId_number_key] UNIQUE NONCLUSTERED ([tenantId],[number])
);

-- CreateTable
CREATE TABLE [dbo].[SalesOrderItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [salesOrderId] INT NOT NULL,
    [productId] INT NOT NULL,
    [productName] NVARCHAR(160) NOT NULL,
    [sku] NVARCHAR(60) NOT NULL,
    [quantity] INT NOT NULL,
    [unitPrice] DECIMAL(14,2) NOT NULL,
    [unitCost] DECIMAL(14,2) NOT NULL CONSTRAINT [SalesOrderItem_unitCost_df] DEFAULT 0,
    [lineTotal] DECIMAL(14,2) NOT NULL,
    CONSTRAINT [SalesOrderItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseOrder] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [number] NVARCHAR(30) NOT NULL,
    [supplierId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [PurchaseOrder_status_df] DEFAULT 'DRAFT',
    [orderDate] DATETIME2 NOT NULL CONSTRAINT [PurchaseOrder_orderDate_df] DEFAULT CURRENT_TIMESTAMP,
    [expectedDate] DATETIME2,
    [total] DECIMAL(14,2) NOT NULL CONSTRAINT [PurchaseOrder_total_df] DEFAULT 0,
    [notes] NVARCHAR(max),
    [createdById] INT NOT NULL,
    [orderedAt] DATETIME2,
    [receivedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PurchaseOrder_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PurchaseOrder_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PurchaseOrder_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId],[id]),
    CONSTRAINT [PurchaseOrder_tenantId_number_key] UNIQUE NONCLUSTERED ([tenantId],[number])
);

-- CreateTable
CREATE TABLE [dbo].[PurchaseOrderItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [purchaseOrderId] INT NOT NULL,
    [productId] INT NOT NULL,
    [productName] NVARCHAR(160) NOT NULL,
    [sku] NVARCHAR(60) NOT NULL,
    [quantity] INT NOT NULL,
    [unitCost] DECIMAL(14,2) NOT NULL,
    [lineTotal] DECIMAL(14,2) NOT NULL,
    CONSTRAINT [PurchaseOrderItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CustomerPayment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [customerId] INT NOT NULL,
    [salesOrderId] INT,
    [amount] DECIMAL(14,2) NOT NULL,
    [method] NVARCHAR(20) NOT NULL,
    [paidAt] DATETIME2 NOT NULL,
    [reference] NVARCHAR(100),
    [notes] NVARCHAR(255),
    [createdById] INT NOT NULL,
    [voidedAt] DATETIME2,
    [voidedById] INT,
    [voidReason] NVARCHAR(255),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CustomerPayment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CustomerPayment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SupplierPayment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [supplierId] INT NOT NULL,
    [purchaseOrderId] INT,
    [amount] DECIMAL(14,2) NOT NULL,
    [method] NVARCHAR(20) NOT NULL,
    [paidAt] DATETIME2 NOT NULL,
    [reference] NVARCHAR(100),
    [notes] NVARCHAR(255),
    [createdById] INT NOT NULL,
    [voidedAt] DATETIME2,
    [voidedById] INT,
    [voidReason] NVARCHAR(255),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SupplierPayment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SupplierPayment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DocumentSequence] (
    [tenantId] INT NOT NULL,
    [docType] NVARCHAR(20) NOT NULL,
    [nextValue] INT NOT NULL CONSTRAINT [DocumentSequence_nextValue_df] DEFAULT 1,
    CONSTRAINT [DocumentSequence_pkey] PRIMARY KEY CLUSTERED ([tenantId],[docType])
);

-- CreateTable
CREATE TABLE [dbo].[ActivityLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tenantId] INT NOT NULL,
    [userId] INT NOT NULL,
    [action] NVARCHAR(60) NOT NULL,
    [entityType] NVARCHAR(40) NOT NULL,
    [entityId] INT NOT NULL,
    [metadata] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ActivityLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ActivityLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_tenantId_idx] ON [dbo].[User]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_userId_idx] ON [dbo].[RefreshToken]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_family_idx] ON [dbo].[RefreshToken]([family]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_tenantId_name_idx] ON [dbo].[Product]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_tenantId_isActive_idx] ON [dbo].[Product]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_productId_createdAt_idx] ON [dbo].[StockMovement]([tenantId], [productId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StockMovement_tenantId_createdAt_idx] ON [dbo].[StockMovement]([tenantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Customer_tenantId_name_idx] ON [dbo].[Customer]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Supplier_tenantId_name_idx] ON [dbo].[Supplier]([tenantId], [name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SalesOrder_tenantId_customerId_status_idx] ON [dbo].[SalesOrder]([tenantId], [customerId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SalesOrder_tenantId_status_confirmedAt_idx] ON [dbo].[SalesOrder]([tenantId], [status], [confirmedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SalesOrderItem_tenantId_productId_idx] ON [dbo].[SalesOrderItem]([tenantId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrder_tenantId_supplierId_status_idx] ON [dbo].[PurchaseOrder]([tenantId], [supplierId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PurchaseOrderItem_tenantId_productId_idx] ON [dbo].[PurchaseOrderItem]([tenantId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomerPayment_tenantId_customerId_paidAt_idx] ON [dbo].[CustomerPayment]([tenantId], [customerId], [paidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomerPayment_tenantId_paidAt_idx] ON [dbo].[CustomerPayment]([tenantId], [paidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupplierPayment_tenantId_supplierId_paidAt_idx] ON [dbo].[SupplierPayment]([tenantId], [supplierId], [paidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupplierPayment_tenantId_paidAt_idx] ON [dbo].[SupplierPayment]([tenantId], [paidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ActivityLog_tenantId_createdAt_idx] ON [dbo].[ActivityLog]([tenantId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Category] ADD CONSTRAINT [Category_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_tenantId_productId_fkey] FOREIGN KEY ([tenantId], [productId]) REFERENCES [dbo].[Product]([tenantId],[id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Customer] ADD CONSTRAINT [Customer_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CustomerPrice] ADD CONSTRAINT [CustomerPrice_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CustomerPrice] ADD CONSTRAINT [CustomerPrice_tenantId_customerId_fkey] FOREIGN KEY ([tenantId], [customerId]) REFERENCES [dbo].[Customer]([tenantId],[id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CustomerPrice] ADD CONSTRAINT [CustomerPrice_tenantId_productId_fkey] FOREIGN KEY ([tenantId], [productId]) REFERENCES [dbo].[Product]([tenantId],[id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Supplier] ADD CONSTRAINT [Supplier_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalesOrder] ADD CONSTRAINT [SalesOrder_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalesOrder] ADD CONSTRAINT [SalesOrder_tenantId_customerId_fkey] FOREIGN KEY ([tenantId], [customerId]) REFERENCES [dbo].[Customer]([tenantId],[id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalesOrderItem] ADD CONSTRAINT [SalesOrderItem_tenantId_salesOrderId_fkey] FOREIGN KEY ([tenantId], [salesOrderId]) REFERENCES [dbo].[SalesOrder]([tenantId],[id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SalesOrderItem] ADD CONSTRAINT [SalesOrderItem_tenantId_productId_fkey] FOREIGN KEY ([tenantId], [productId]) REFERENCES [dbo].[Product]([tenantId],[id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrder] ADD CONSTRAINT [PurchaseOrder_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrder] ADD CONSTRAINT [PurchaseOrder_tenantId_supplierId_fkey] FOREIGN KEY ([tenantId], [supplierId]) REFERENCES [dbo].[Supplier]([tenantId],[id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderItem] ADD CONSTRAINT [PurchaseOrderItem_tenantId_purchaseOrderId_fkey] FOREIGN KEY ([tenantId], [purchaseOrderId]) REFERENCES [dbo].[PurchaseOrder]([tenantId],[id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PurchaseOrderItem] ADD CONSTRAINT [PurchaseOrderItem_tenantId_productId_fkey] FOREIGN KEY ([tenantId], [productId]) REFERENCES [dbo].[Product]([tenantId],[id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CustomerPayment] ADD CONSTRAINT [CustomerPayment_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CustomerPayment] ADD CONSTRAINT [CustomerPayment_tenantId_customerId_fkey] FOREIGN KEY ([tenantId], [customerId]) REFERENCES [dbo].[Customer]([tenantId],[id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CustomerPayment] ADD CONSTRAINT [CustomerPayment_salesOrderId_fkey] FOREIGN KEY ([salesOrderId]) REFERENCES [dbo].[SalesOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupplierPayment] ADD CONSTRAINT [SupplierPayment_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupplierPayment] ADD CONSTRAINT [SupplierPayment_tenantId_supplierId_fkey] FOREIGN KEY ([tenantId], [supplierId]) REFERENCES [dbo].[Supplier]([tenantId],[id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupplierPayment] ADD CONSTRAINT [SupplierPayment_purchaseOrderId_fkey] FOREIGN KEY ([purchaseOrderId]) REFERENCES [dbo].[PurchaseOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DocumentSequence] ADD CONSTRAINT [DocumentSequence_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ActivityLog] ADD CONSTRAINT [ActivityLog_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Integrity guarantees Prisma's schema language cannot express (added by hand).
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_stockQty_nonneg] CHECK ([stockQty] >= 0);
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_prices_nonneg] CHECK ([costPrice] >= 0 AND [salePrice] >= 0);
ALTER TABLE [dbo].[SalesOrderItem] ADD CONSTRAINT [SalesOrderItem_quantity_pos] CHECK ([quantity] > 0);
ALTER TABLE [dbo].[PurchaseOrderItem] ADD CONSTRAINT [PurchaseOrderItem_quantity_pos] CHECK ([quantity] > 0);
ALTER TABLE [dbo].[CustomerPayment] ADD CONSTRAINT [CustomerPayment_amount_pos] CHECK ([amount] > 0);
ALTER TABLE [dbo].[SupplierPayment] ADD CONSTRAINT [SupplierPayment_amount_pos] CHECK ([amount] > 0);
ALTER TABLE [dbo].[SalesOrder] ADD CONSTRAINT [SalesOrder_amounts_nonneg] CHECK ([discount] >= 0 AND [discount] <= [subtotal] AND [total] >= 0);

-- Enum columns (SQL Server has no enum type). Keep in sync with src/common/enums.ts.
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_role_enum] CHECK ([role] IN (N'OWNER', N'MANAGER', N'STAFF'));
ALTER TABLE [dbo].[StockMovement] ADD CONSTRAINT [StockMovement_type_enum] CHECK ([type] IN (N'OPENING', N'SALE', N'SALE_CANCEL', N'PURCHASE_RECEIPT', N'ADJUSTMENT'));
ALTER TABLE [dbo].[SalesOrder] ADD CONSTRAINT [SalesOrder_status_enum] CHECK ([status] IN (N'DRAFT', N'CONFIRMED', N'DELIVERED', N'CANCELLED'));
ALTER TABLE [dbo].[PurchaseOrder] ADD CONSTRAINT [PurchaseOrder_status_enum] CHECK ([status] IN (N'DRAFT', N'ORDERED', N'RECEIVED', N'CANCELLED'));
ALTER TABLE [dbo].[CustomerPayment] ADD CONSTRAINT [CustomerPayment_method_enum] CHECK ([method] IN (N'CASH', N'BANK_TRANSFER', N'CHEQUE', N'OTHER'));
ALTER TABLE [dbo].[SupplierPayment] ADD CONSTRAINT [SupplierPayment_method_enum] CHECK ([method] IN (N'CASH', N'BANK_TRANSFER', N'CHEQUE', N'OTHER'));
ALTER TABLE [dbo].[DocumentSequence] ADD CONSTRAINT [DocumentSequence_docType_enum] CHECK ([docType] IN (N'SALES_ORDER', N'PURCHASE_ORDER'));

-- Activity metadata is JSON text.
ALTER TABLE [dbo].[ActivityLog] ADD CONSTRAINT [ActivityLog_metadata_json] CHECK ([metadata] IS NULL OR ISJSON([metadata]) = 1);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
