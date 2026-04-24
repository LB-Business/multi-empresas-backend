import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://frontend-lb-business.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requests sin origin, como Postman, Swagger o navegador directo
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('CORS blocked origin:', origin);
      return callback(new Error(`CORS blocked origin: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Concesionaria Backend Starter')
    .setDescription(
      'Starter API for admin panel, owner metrics, and fully custom dealership landing pages.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);

  console.log(`API ready on http://localhost:${port}/api`);
  console.log(`Swagger ready on http://localhost:${port}/docs`);
}

void bootstrap();