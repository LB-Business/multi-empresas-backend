import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173',

      'https://lb-business.vercel.app',
      'https://maite-puce.vercel.app',
      'https://loval-motors.vercel.app',

      'https://lbcodeworks.com.ar',
      'https://www.lbcodeworks.com.ar',
      'https://dashboard.lbcodeworks.com.ar',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
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