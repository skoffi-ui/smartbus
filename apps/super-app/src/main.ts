import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SuperAppModule } from './super-app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(SuperAppModule);

  // Configuration MVC (Handlebars)
  app.useStaticAssets(join(process.cwd(), 'apps/super-app/src/public'));
  app.setBaseViewsDir(join(process.cwd(), 'apps/super-app/src/views'));
  app.setViewEngine('hbs');

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
    .setTitle('SMARTBUS – Super App API')
    .setDescription(
      'API centrale de gestion du transport scolaire multi-tenant SMARTBUS',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification et gestion des sessions')
    .addTag('users', 'Gestion des utilisateurs')
    .addTag('organisations', 'Gestion des organisations / établissements')
    .addTag('roles', 'Gestion des rôles et permissions RBAC')
    .addTag('subscriptions', 'Gestion des abonnements')
    .addTag('billing', 'Facturation et paiements')
    .addTag('provisioning', 'Provisionnement des bases de données école')
    .addTag('metadata', 'Versionnage du schéma (table meta_data)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.SUPER_APP_PORT || 3000;
  await app.listen(port);

  console.log(`\n🚌 SMARTBUS Super App running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs\n`);
}

bootstrap();
