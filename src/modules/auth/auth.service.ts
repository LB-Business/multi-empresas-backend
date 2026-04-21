import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessesService } from '../businesses/businesses.service';
import { UsersService } from '../users/users.service';
import { BootstrapSuperAdminDto } from './dto/bootstrap-super-admin.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterOwnerDto } from './dto/register-owner.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async bootstrapSuperAdmin(
    dto: BootstrapSuperAdminDto,
    bootstrapKey?: string,
  ) {
    const expectedBootstrapKey =
      this.configService.get<string>('BOOTSTRAP_SUPER_ADMIN_KEY') ??
      process.env.BOOTSTRAP_SUPER_ADMIN_KEY;

    if (!expectedBootstrapKey) {
      throw new UnauthorizedException('Bootstrap key is not configured');
    }

    if (!bootstrapKey || bootstrapKey !== expectedBootstrapKey) {
      throw new UnauthorizedException('Invalid bootstrap key');
    }

    const existingSuperAdmins = await this.usersService.countByRole(
      UserRole.SUPER_ADMIN,
    );

    if (existingSuperAdmins > 0) {
      throw new ConflictException('SUPER_ADMIN already bootstrapped');
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersService.createInternal({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    });

    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      businessId: '',
    });

    await this.usersService.setRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      message: 'SUPER_ADMIN bootstrapped successfully',
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async registerOwner(dto: RegisterOwnerDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const existingBusiness = await this.businessesService.findBySlug(
      dto.businessSlug,
    );

    if (existingBusiness) {
      throw new ConflictException('Business slug already in use');
    }

    const business = await this.businessesService.create({
      name: dto.businessName,
      slug: dto.businessSlug,
    });

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersService.createInternal({
      businessId: business.id,
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: UserRole.OWNER,
    });

    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId ? user.businessId.toString() : '',
    });

    await this.usersService.setRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      message: 'Owner registered successfully',
      business,
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: CurrentUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId ? user.businessId.toString() : '',
    };

    const tokens = await this.issueTokens(payload);
    await this.usersService.setRefreshTokenHash(user.id, tokens.refreshToken);
    await this.usersService.touchLastLogin(user.id);

    return {
      message: 'Login successful',
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<CurrentUser>(
        dto.refreshToken,
        {
          secret: this.configService.get<string>('auth.jwtRefreshSecret'),
        },
      );

      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.refreshTokenHash || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const matches = await argon2.verify(
        user.refreshTokenHash,
        dto.refreshToken,
      );

      if (!matches) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload: CurrentUser = {
        sub: user.id,
        email: user.email,
        role: user.role,
        businessId: user.businessId ? user.businessId.toString() : '',
      };

      const tokens = await this.issueTokens(newPayload);
      await this.usersService.setRefreshTokenHash(user.id, tokens.refreshToken);

      return {
        message: 'Token refreshed',
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshTokenHash(userId);
    return { message: 'Logout successful' };
  }

  private async issueTokens(payload: CurrentUser) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('auth.jwtAccessSecret'),
        expiresIn: this.configService.get<string>('auth.accessTokenTtl'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
        expiresIn: this.configService.get<string>('auth.refreshTokenTtl'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}