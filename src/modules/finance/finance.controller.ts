import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FindFinanceDto } from './dto/find-finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('sync')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Sync finance movements from products and expenses' })
  sync(
    @Query() query: FindFinanceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.financeService.syncMovements(currentUser, query.month);
  }

  @Get('movements')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'List finance movements' })
  getMovements(
    @Query() query: FindFinanceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.financeService.getMovements(currentUser, query.month);
  }

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Get finance summary' })
  getSummary(
    @Query() query: FindFinanceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.financeService.getSummary(currentUser, query.month);
  }
}