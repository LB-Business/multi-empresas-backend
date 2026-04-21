import {
  Body,
  Controller,
  Get,
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
import { CreateMovementInput, MovementsService } from './movements.service';

@ApiTags('Movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create movement' })
  async create(
    @Body() movement: CreateMovementInput,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.movementsService.createMovement(movement, currentUser);
  }

  @Get('day')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get business movements by day' })
  async getByDay(
    @Query('date') date: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.movementsService.getMovementsByDay(currentUser, date);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get business movements by month' })
  async getAll(
    @Query('month') month: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.movementsService.getMovements(currentUser, month);
  }
}