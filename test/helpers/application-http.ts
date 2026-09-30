import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';

/**
 * Même pipeline HTTP que `main.ts` des apps (préfixe, version d'URI, validation).
 * Sans le versionnage, les cas qui appellent `/api/v1/...` tombent sur une 404.
 */
export function configurerApplicationHttp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors();
}
