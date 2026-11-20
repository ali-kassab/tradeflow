import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, ManagerOrAbove } from '../../common/auth.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { CategoryDto, CreateProductDto, ProductQueryDto, UpdateProductDto } from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.catalog.listCategories(user);
  }

  @ManagerOrAbove()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CategoryDto) {
    return this.catalog.createCategory(user, dto);
  }

  @ManagerOrAbove()
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.catalog.updateCategory(user, id, dto);
  }

  @ManagerOrAbove()
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.deleteCategory(user, id);
  }
}

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ProductQueryDto) {
    return this.catalog.listProducts(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.getProduct(user, id);
  }

  @ManagerOrAbove()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(user, dto);
  }

  @ManagerOrAbove()
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.catalog.updateProduct(user, id, dto);
  }

  @ManagerOrAbove()
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.catalog.deleteProduct(user, id);
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CatalogService],
})
export class CatalogModule {}
