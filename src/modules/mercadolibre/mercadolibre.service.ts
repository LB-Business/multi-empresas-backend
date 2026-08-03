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
import {
  MercadoLibreQuestion,
  MercadoLibreQuestionDocument,
} from './mercadolibre-question.schema';
import { Property, PropertyDocument } from '../properties/property.schema';

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

type ListQuestionsOptions = {
  status?: string;
  itemId?: string;
  propertyId?: string;
  sync?: boolean;
  limit?: number;
};

type SyncQuestionsOptions = {
  status?: string;
  itemId?: string;
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

function toObjectId(value: string) {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException('ID inválido');
  }

  return new Types.ObjectId(value);
}

function parseDate(value: any) {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isAllStatus(status?: string) {
  return !status || ['ALL', 'TODAS', 'TODOS'].includes(String(status).toUpperCase());
}

function normalizeStatus(status?: string) {
  if (!status) return undefined;
  return String(status).trim().toUpperCase();
}

function getQuestionIdFromResource(resource?: string) {
  if (!resource) return '';

  const match = String(resource).match(/questions\/([0-9]+)/i);
  return match?.[1] || '';
}

@Injectable()
export class MercadoLibreService {
  constructor(
    @InjectModel(MercadoLibreAccount.name)
    private readonly mlAccountModel: Model<MercadoLibreAccountDocument>,

    @InjectModel(MercadoLibreQuestion.name)
    private readonly mlQuestionModel: Model<MercadoLibreQuestionDocument>,

    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
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

    return this.ensureAccountAccessToken(account);
  }

  async listQuestions(businessId: string, options: ListQuestionsOptions = {}) {
    if (options.sync) {
      await this.syncQuestionsByBusiness(businessId, {
        status: options.status,
        itemId: options.itemId,
      });
    }

    const query: any = {
      businessId: new Types.ObjectId(businessId),
    };

    if (!isAllStatus(options.status)) {
      query.status = normalizeStatus(options.status);
    }

    if (options.itemId) {
      query.mlItemId = String(options.itemId).trim();
    }

    if (options.propertyId && Types.ObjectId.isValid(options.propertyId)) {
      query.propertyId = new Types.ObjectId(options.propertyId);
    }

    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 100);

    const questions = await this.mlQuestionModel
      .find(query)
      .sort({ dateCreated: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      ok: true,
      count: questions.length,
      questions: await this.enrichQuestions(questions),
    };
  }

  async getQuestion(businessId: string, questionId: string) {
    const question = await this.mlQuestionModel
      .findOne({
        businessId: new Types.ObjectId(businessId),
        mlQuestionId: Number(questionId),
      })
      .lean();

    if (!question) {
      throw new NotFoundException('Pregunta no encontrada');
    }

    const [enriched] = await this.enrichQuestions([question]);
    return enriched;
  }

  async syncQuestionsByBusiness(
    businessId: string,
    options: SyncQuestionsOptions = {},
  ) {
    const account = await this.mlAccountModel.findOne({
      businessId: new Types.ObjectId(businessId),
      isActive: true,
    });

    if (!account) {
      throw new UnauthorizedException('Mercado Libre no está conectado');
    }

    const accessToken = await this.ensureAccountAccessToken(account);

    const params = new URLSearchParams({
      seller_id: String(account.mlUserId),
      limit: '50',
      offset: '0',
    });

    if (options.itemId) {
      params.set('item', String(options.itemId).trim());
    }

    if (!isAllStatus(options.status)) {
      params.set('status', normalizeStatus(options.status) || 'UNANSWERED');
    }

    const res = await fetch(
      `https://api.mercadolibre.com/questions/search?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      },
    );

    const data = await readJsonResponse<any>(res);
    const questions = Array.isArray(data?.questions) ? data.questions : [];

    const saved = [];

    for (const question of questions) {
      const savedQuestion = await this.upsertQuestionFromMercadoLibre(
        String(businessId),
        question,
        Number(account.mlUserId),
      );

      if (savedQuestion) {
        saved.push(savedQuestion);
      }
    }

    return {
      ok: true,
      synced: saved.length,
      paging: data?.paging || null,
      questions: await this.enrichQuestions(saved),
    };
  }

  async answerQuestion(businessId: string, questionId: string, text: string) {
    const cleanText = String(text || '').trim();

    if (!cleanText) {
      throw new BadRequestException('La respuesta no puede estar vacía');
    }

    if (cleanText.length > 2000) {
      throw new BadRequestException('La respuesta es demasiado larga');
    }

    const numericQuestionId = Number(questionId);

    if (!Number.isFinite(numericQuestionId)) {
      throw new BadRequestException('questionId inválido');
    }

    const account = await this.mlAccountModel.findOne({
      businessId: new Types.ObjectId(businessId),
      isActive: true,
    });

    if (!account) {
      throw new UnauthorizedException('Mercado Libre no está conectado');
    }

    const accessToken = await this.ensureAccountAccessToken(account);

    const res = await fetch('https://api.mercadolibre.com/answers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question_id: numericQuestionId,
        text: cleanText,
      }),
    });

    const answerData = await readJsonResponse<any>(res);

    await this.mlQuestionModel.updateOne(
      {
        businessId: new Types.ObjectId(businessId),
        mlQuestionId: numericQuestionId,
      },
      {
        $set: {
          status: 'ANSWERED',
          answerText: cleanText,
          answeredAt: new Date(),
          lastSyncedAt: new Date(),
          rawAnswer: answerData,
        },
      },
      { upsert: false },
    );

    const question = await this.mlQuestionModel
      .findOne({
        businessId: new Types.ObjectId(businessId),
        mlQuestionId: numericQuestionId,
      })
      .lean();

    return {
      ok: true,
      answer: answerData,
      question: question ? (await this.enrichQuestions([question]))[0] : null,
    };
  }

  async handleNotification(body: any, query: any) {
    console.log('ML NOTIFICATION BODY:', body);
    console.log('ML NOTIFICATION QUERY:', query);

    const userId = Number(body?.user_id || query?.user_id || 0);
    const topic = String(body?.topic || query?.topic || '').toLowerCase();
    const resource = String(body?.resource || query?.resource || '');
    const questionId = getQuestionIdFromResource(resource);

    const looksLikeQuestion =
      topic.includes('question') ||
      resource.includes('/questions/') ||
      body?.type === 'question';

    if (!looksLikeQuestion) {
      return {
        ok: true,
        ignored: true,
        reason: 'notification_not_question',
      };
    }

    const account = await this.mlAccountModel.findOne({
      ...(userId ? { mlUserId: userId } : {}),
      isActive: true,
    });

    if (!account) {
      return {
        ok: true,
        skipped: true,
        reason: 'account_not_found_for_notification',
      };
    }

    const businessId = String(account.businessId);

    try {
      if (questionId) {
        const accessToken = await this.ensureAccountAccessToken(account);
        const question = await this.fetchQuestionById(questionId, accessToken);
        const saved = await this.upsertQuestionFromMercadoLibre(
          businessId,
          question,
          Number(account.mlUserId),
        );

        return {
          ok: true,
          type: 'question',
          questionId,
          saved: !!saved,
        };
      }

      const synced = await this.syncQuestionsByBusiness(businessId, {
        status: 'UNANSWERED',
      });

      return {
        ok: true,
        type: 'question_sync',
        synced: synced.synced,
      };
    } catch (error: any) {
      console.error('ML NOTIFICATION PROCESS ERROR:', error?.response || error);

      return {
        ok: true,
        warning: true,
        reason: 'notification_received_but_processing_failed',
        message: error?.message || 'Error procesando notificación',
      };
    }
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

  private async ensureAccountAccessToken(account: MercadoLibreAccountDocument) {
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

  private async fetchQuestionById(questionId: string, accessToken: string) {
    const res = await fetch(`https://api.mercadolibre.com/questions/${questionId}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    });

    return readJsonResponse<any>(res);
  }

  private async upsertQuestionFromMercadoLibre(
    businessId: string,
    question: any,
    sellerId?: number,
  ) {
    const mlQuestionId = Number(question?.id || question?.question_id || 0);
    const mlItemId = String(question?.item_id || question?.item?.id || '').trim();

    if (!mlQuestionId || !mlItemId) {
      return null;
    }

    const property = await this.propertyModel
      .findOne({
        businessId: new Types.ObjectId(businessId),
        'ml.itemId': mlItemId,
      })
      .select('_id title slug ml')
      .lean();

    const answer = question?.answer || null;

    const saved = await this.mlQuestionModel
      .findOneAndUpdate(
        {
          businessId: new Types.ObjectId(businessId),
          mlQuestionId,
        },
        {
          $set: {
            businessId: new Types.ObjectId(businessId),
            propertyId: property?._id,
            mlQuestionId,
            mlItemId,
            sellerId,
            buyerId: Number(question?.from?.id || question?.from?.user_id || 0) || undefined,
            buyerNickname: question?.from?.nickname || '',
            text: question?.text || '',
            status: normalizeStatus(question?.status) || 'UNANSWERED',
            answerText: answer?.text || '',
            answeredAt: parseDate(answer?.date_created),
            dateCreated: parseDate(question?.date_created),
            lastSyncedAt: new Date(),
            raw: question,
          },
        },
        {
          new: true,
          upsert: true,
        },
      )
      .lean();

    return saved;
  }

  private async enrichQuestions(questions: any[]) {
    const propertyIds = questions
      .map((q) => q.propertyId)
      .filter(Boolean)
      .map((id) => String(id));

    const uniquePropertyIds = [...new Set(propertyIds)];

    const properties = uniquePropertyIds.length
      ? await this.propertyModel
          .find({ _id: { $in: uniquePropertyIds.map((id) => new Types.ObjectId(id)) } })
          .select('_id title slug operationType propertyType price currency ml')
          .lean()
      : [];

    const propertyMap = new Map(
      properties.map((property: any) => [String(property._id), property]),
    );

    return questions.map((question: any) => {
      const { raw, __v, ...safeQuestion } = question;
      const property = question.propertyId
        ? propertyMap.get(String(question.propertyId))
        : null;

      return {
        ...safeQuestion,
        property: property
          ? {
              _id: String(property._id),
              title: property.title,
              slug: property.slug,
              operationType: property.operationType,
              propertyType: property.propertyType,
              price: property.price,
              currency: property.currency,
              ml: property.ml,
            }
          : null,
      };
    });
  }

  private sanitizeAccount(account: any) {
    if (!account) return null;

    const { accessToken, refreshToken, __v, ...safeAccount } = account;

    return safeAccount;
  }
}
