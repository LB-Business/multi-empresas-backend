import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FindExpensesDto } from './dto/find-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'List expenses from current business' })
  findAll(
    @Query() query: FindExpensesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.expensesService.findAll(currentUser, query);
  }

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get monthly expense summary from current business' })
  getSummary(
    @Query() query: FindExpensesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.expensesService.getMonthlySummary(currentUser, query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get one expense by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.expensesService.findOne(id, currentUser);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create expense' })
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.expensesService.create(dto, currentUser);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update expense' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.expensesService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete expense' })
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.expensesService.remove(id, currentUser);
  }
}