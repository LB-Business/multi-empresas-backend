import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MercadoLibreAccount,
  MercadoLibreAccountDocument,
} from './mercadolibre-account.schema';

type MercadoLibreTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id: number;
};

type MercadoLibreUserResponse = {
  id: number;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  site_id?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new InternalServerErrorException(`Falta configurar ${name}`);
  }

  return value;
}

function encodeState(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeState(state: string) {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('State inválido');
  }
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new BadRequestException({
      message: data?.message || data?.error || 'Error Mercado Libre',
      status: res.status,
      data,
    });
  }

  return data as T;
}

@Injectable()
export class MercadoLibreService {
  constructor(
    @InjectModel(MercadoLibreAccount.name)
    private readonly mlAccountModel: Model<MercadoLibreAccountDocument>,
  ) {}

  buildAuthUrl(businessId: string, userId?: string) {
    const clientId = requireEnv('ML_APP_ID');
    const redirectUri = requireEnv('ML_REDIRECT_URI');

    const state = encodeState({
      businessId,
      userId,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });

    return {
      url: `https://auth.mercadolibre.com.ar/authorization?${params.toString()}`,
    };
  }

  async handleCallback(code: string, state: string) {
    if (!code) {
      throw new BadRequestException('Falta code');
    }

    if (!state) {
      throw new BadRequestException('Falta state');
    }

    const decodedState = decodeState(state);

    const businessId = String(decodedState.businessId || '');
    const userId = decodedState.userId ? String(decodedState.userId) : undefined;

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('businessId inválido en state');
    }

    const tokenData = await this.exchangeCodeForToken(code);
    const mlUser = await this.getMercadoLibreUser(tokenData.access_token);

    const expiresInSeconds = Number(tokenData.expires_in || 21600);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000 - 60_000);

    const account = await this.mlAccountModel
      .findOneAndUpdate(
        {
          businessId: new Types.ObjectId(businessId),
        },
        {
          $set: {
            businessId: new Types.ObjectId(businessId),
            mlUserId: tokenData.user_id || mlUser.id,
            nickname: mlUser.nickname,
            firstName: mlUser.first_name,
            lastName: mlUser.last_name,
            email: mlUser.email,
            siteId: mlUser.site_id || process.env.ML_SITE_ID || 'MLA',
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenType: tokenData.token_type,
            scope: tokenData.scope,
            expiresAt,
            isActive: true,
            connectedAt: new Date(),
            disconnectedAt: null,
            connectedBy:
              userId && Types.ObjectId.isValid(userId)
                ? new Types.ObjectId(userId)
                : undefined,
          },
        },
        {
          new: true,
          upsert: true,
        },
      )
      .lean();

    return this.sanitizeAccount(account);
  }

  async getAccountByBusiness(businessId: string) {
    const account = await this.mlAccountModel
      .findOne({
        businessId: new Types.ObjectId(businessId),
        isActive: true,
      })
      .lean();

    if (!account) {
      return null;
    }

    return this.sanitizeAccount(account);
  }

  async disconnectAccount(businessId: string) {
    const account = await this.mlAccountModel
      .findOneAndUpdate(
        {
          businessId: new Types.ObjectId(businessId),
        },
        {
          $set: {
            isActive: false,
            disconnectedAt: new Date(),
          },
        },
        {
          new: true,
        },
      )
      .lean();

    if (!account) {
      throw new NotFoundException('Cuenta de Mercado Libre no encontrada');
    }

    return {
      ok: true,
    };
  }

  async getValidAccessToken(businessId: string) {
    const account = await this.mlAccountModel.findOne({
      businessId: new Types.ObjectId(businessId),
      isActive: true,
    });

    if (!account) {
      throw new UnauthorizedException('Mercado Libre no está conectado');
    }

    const expiresAt = account.expiresAt?.getTime() || 0;
    const shouldRefresh = expiresAt < Date.now() + 5 * 60 * 1000;

    if (!shouldRefresh) {
      return account.accessToken;
    }

    const refreshed = await this.refreshToken(account.refreshToken);

    const expiresInSeconds = Number(refreshed.expires_in || 21600);
    const nextExpiresAt = new Date(
      Date.now() + expiresInSeconds * 1000 - 60_000,
    );

    account.accessToken = refreshed.access_token;
    account.refreshToken = refreshed.refresh_token || account.refreshToken;
    account.tokenType = refreshed.token_type;
    account.scope = refreshed.scope;
    account.expiresAt = nextExpiresAt;
    account.lastTokenRefreshAt = new Date();

    await account.save();

    return account.accessToken;
  }

  async handleNotification(body: any, query: any) {
    console.log('ML NOTIFICATION BODY:', body);
    console.log('ML NOTIFICATION QUERY:', query);

    return {
      ok: true,
    };
  }

  private async exchangeCodeForToken(code: string) {
    const clientId = requireEnv('ML_APP_ID');
    const clientSecret = requireEnv('ML_CLIENT_SECRET');
    const redirectUri = requireEnv('ML_REDIRECT_URI');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    return readJsonResponse<MercadoLibreTokenResponse>(res);
  }

  private async refreshToken(refreshToken: string) {
    const clientId = requireEnv('ML_APP_ID');
    const clientSecret = requireEnv('ML_CLIENT_SECRET');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    return readJsonResponse<MercadoLibreTokenResponse>(res);
  }

  private async getMercadoLibreUser(accessToken: string) {
    const res = await fetch('https://api.mercadolibre.com/users/me', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    });

    return readJsonResponse<MercadoLibreUserResponse>(res);
  }

  private sanitizeAccount(account: any) {
    if (!account) return null;

    const {
      accessToken,
      refreshToken,
      __v,
      ...safeAccount
    } = account;

    return safeAccount;
  }
}