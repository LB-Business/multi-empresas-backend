import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'replace-me-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'replace-me-refresh-secret',
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '7d',
}));
