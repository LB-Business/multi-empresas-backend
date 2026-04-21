import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from 'src/common/enums/user-role.enum';

export class CreateUserBySuperAdminDto {
  @ApiProperty({ example: '69c1532e3cffc88eecea20a0' })
  @IsMongoId()
  businessId!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'owner@lovalmotors.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Loval12345!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    enum: [UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR],
    example: UserRole.OWNER,
  })
  @IsIn([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR])
  role!: UserRole;
}