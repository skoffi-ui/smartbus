import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SchoolAppModule } from './school-app.module';

async function bootstrap() {
  const app = await NestFactory.create(SchoolAppModule);

  // Préfixe global de l'API
  app.setGlobalPrefix('api');

  // Versionnage
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors();

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('SMARTBUS – App École API')
    .setDescription(
      'API dédiée à la gestion des établissements scolaires : enfants, parents, chauffeurs, cars, trajets, courses et biométrie',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification via Super App')
    .addTag('children', 'Gestion des enfants et empreintes biométriques')
    .addTag('parents', 'Gestion des parents et liens parent-enfant')
    .addTag('drivers', 'Gestion des chauffeurs')
    .addTag('cars', 'Gestion du parc automobile')
    .addTag('routes', 'Gestion des trajets et points d\'arrêt')
    .addTag('trips', 'Gestion des courses (exécution des trajets)')
    .addTag('biometric-events', 'Événements biométriques (montée/descente)')
    .addTag('notifications', 'Notifications aux parents')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.SCHOOL_APP_PORT || 3001;
  await app.listen(port);

  console.log(`\n🏫 SMARTBUS School App running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs\n`);
}

bootstrap();
