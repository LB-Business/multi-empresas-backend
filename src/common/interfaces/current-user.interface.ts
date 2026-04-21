import { UserRole } from '../enums/user-role.enum';

export interface CurrentUser {
  sub: string;
  email: string;
  role: UserRole;
  businessId: string;
}