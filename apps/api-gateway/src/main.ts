import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { GatewayModule } from './gateway.module';
import { GatewayService } from './gateway.service';

async function bootstrap() {
  // bodyParser désactivé : le corps des requêtes doit être relayé tel quel aux services
  const app = await NestFactory.create<NestExpressApplication>(GatewayModule, { bodyParser: false });

  app.enableCors();

  const gateway = app.get(GatewayService);

  // /health est servi par la gateway elle-même ; tout le reste est routé vers un service
  const handle = gateway.handler();
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path === '/health' ? next() : handle(req, res, next),
  );

  const port = process.env.GATEWAY_PORT || 3002;
  await app.listen(port);

  // Socket.IO (flux matériel temps réel) : relais des connexions WebSocket
  app.getHttpServer().on('upgrade', (req, socket, head) => gateway.upgrade(req, socket, head));

  console.log(`\n🚪 SMARTBUS API Gateway running on: http://localhost:${port}\n`);
}

bootstrap();
