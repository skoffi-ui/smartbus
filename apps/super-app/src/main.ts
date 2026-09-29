import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SuperAppModule } from './super-app.module';
import {
  CINETPAY_WEBHOOK_SECRET_HEADER,
  CINETPAY_WEBHOOK_SECURITY_SCHEME,
} from './modules/payments/payment-webhook.constants';

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
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: CINETPAY_WEBHOOK_SECRET_HEADER,
        description:
          'Secret partagé du webhook de paiement (variable CINETPAY_WEBHOOK_SECRET). Distinct du JWT utilisateur.',
      },
      CINETPAY_WEBHOOK_SECURITY_SCHEME,
    )
    .addTag('auth', 'Authentification et gestion des sessions')
    .addTag('users', 'Gestion des utilisateurs')
    .addTag('organisations', 'Gestion des organisations / établissements')
    .addTag('roles', 'Gestion des rôles et permissions RBAC')
    .addTag('subscriptions', 'Gestion des abonnements')
    .addTag('billing', 'Facturation et paiements')
    .addTag('payments', 'Paiements et notification CinetPay (secret partagé, sans JWT)')
    .addTag('provisioning', 'Provisionnement des bases de données école')
    .addTag('metadata', 'Versionnage du schéma (table meta_data)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // La gateway est censée être la seule porte d'entrée : elle seule vérifie le JWT,
  // la version d'application et le statut de l'école. Or ce service écoutait sur
  // toutes les interfaces, donc joignable directement depuis le réseau — il
  // suffisait d'appeler le port pour contourner ces contrôles. Il n'écoute
  // désormais que la boucle locale, sauf hôte explicitement configuré (conteneurs).
  const host = process.env.BIND_HOST || '127.0.0.1';
  const port = process.env.SUPER_APP_PORT || 3000;
  await app.listen(port, host);

  console.log(`\n🚌 SMARTBUS Super App running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs\n`);
}

bootstrap();
