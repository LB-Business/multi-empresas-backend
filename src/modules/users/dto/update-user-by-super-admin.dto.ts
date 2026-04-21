import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { CreateUserBySuperAdminDto } from './create-user-by-super-admin.dto';

export class UpdateUserBySuperAdminDto extends PartialType(
  CreateUserBySuperAdminDto,
) {
  @ApiPropertyOptional({
    enum: [UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR],
    example: UserRole.ADMIN,
  })
  @IsOptional()
  @IsIn([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR])
  role?: UserRole;

  @ApiPropertyOptional({ example: '69c1532e3cffc88eecea20a0' })
  @IsOptional()
  @IsMongoId()
  businessId?: string;
}