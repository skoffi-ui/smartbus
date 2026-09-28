import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { GatewayTarget, resolveRoute } from './route-table';
import { TenantGateService } from './tenant-gate.service';
import { compareVersions } from './version.util';

/** En-têtes d'identité posés par la gateway : jamais acceptés depuis l'extérieur. */
const TRUSTED_HEADERS = ['x-tenant-id', 'x-tenant-schema', 'x-user-id', 'x-user-role', 'x-allowed-features'];

interface TokenPayload {
  sub: string;
  role?: string;
  organisationId?: string;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  private readonly targets: Record<GatewayTarget, string>;
  private readonly minAppVersion: string;
  private readonly proxies: Record<GatewayTarget, ReturnType<typeof createProxyMiddleware>>;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly tenantGate: TenantGateService,
  ) {
    this.targets = {
      super: this.config.get<string>('SUPER_APP_URL', 'http://localhost:3000'),
      school: this.config.get<string>('SCHOOL_APP_URL', 'http://localhost:3001'),
    };
    this.minAppVersion = this.config.get<string>('APP_MIN_VERSION', '0.0.0');

    this.proxies = {
      super: this.buildProxy('super'),
      school: this.buildProxy('school'),
    };
  }

  private buildProxy(target: GatewayTarget) {
    return createProxyMiddleware({
      target: this.targets[target],
      changeOrigin: true,
      on: {
        error: (err, _req, res) => {
          this.logger.error(`Service "${target}" injoignable : ${(err as Error).message}`);
          const response = res as Response;
          if (typeof response.status === 'function' && !response.headersSent) {
            response.status(502).json({
              statusCode: 502,
              code: 'UPSTREAM_UNAVAILABLE',
              message: `Le service "${target}" est momentanément indisponible.`,
            });
          }
        },
      },
    });
  }

  /** Middleware Express : authentification, contrôle d'accès puis proxy. */
  handler(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await this.route(req, res);
      } catch (err) {
        next(err);
      }
    };
  }

  /** Relaie les connexions WebSocket (Socket.IO) vers la SUPER APP (flux matériel temps réel). */
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const proxy = this.proxies.super as unknown as {
      upgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
    };
    proxy.upgrade(req, socket, head);
  }

  private async route(req: Request, res: Response): Promise<void> {
    // 1. Ne jamais faire confiance aux en-têtes d'identité fournis par le client
    for (const header of TRUSTED_HEADERS) delete req.headers[header];

    const path = req.originalUrl || req.url;

    // 2. Résolution de la route (toute route inconnue ou interne est refusée)
    const route = resolveRoute(req.method, path);
    if (!route) {
      this.reject(res, 404, 'ROUTE_NOT_FOUND', 'Route inconnue.');
      return;
    }

    // 3. Routes protégées : JWT, version d'application, statut de l'école
    if (!route.isPublic) {
      const payload = await this.authenticate(req, res);
      if (!payload) return;

      if (!this.isAppVersionSupported(req, res)) return;

      if (route.target === 'school') {
        const tenantResult = await this.checkTenant(payload, res);
        if (!tenantResult.ok) return;
        // Lu frais depuis la base centrale (voir TenantGateService), pas depuis le
        // jeton : une restriction ou un déblocage de fonctionnalité prend donc
        // effet en au plus TenantGateService.TTL_MS, sans attendre l'expiration
        // du jeton d'accès ni un rafraîchissement déclenché côté client. Toujours
        // posé (y compris `"null"` = aucune restriction) pour que school-app ne
        // retombe jamais sur la valeur potentiellement périmée du JWT.
        req.headers['x-allowed-features'] = JSON.stringify(tenantResult.allowedFeatures);
      }

      req.headers['x-user-id'] = payload.sub;
      if (payload.role) req.headers['x-user-role'] = payload.role;
      if (payload.organisationId) req.headers['x-tenant-id'] = payload.organisationId;
    }

    // 4. Routage vers le bon service
    (this.proxies[route.target] as unknown as RequestHandler)(req, res, () => undefined);
  }

  private async authenticate(req: Request, res: Response): Promise<TokenPayload | null> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      this.reject(res, 401, 'TOKEN_MISSING', 'Token manquant ou invalide.');
      return null;
    }

    try {
      return await this.jwt.verifyAsync<TokenPayload>(header.slice(7));
    } catch {
      this.reject(res, 401, 'TOKEN_INVALID', 'Session invalide ou expirée.');
      return null;
    }
  }

  /**
   * Bloque les clients dont la version est inférieure à APP_MIN_VERSION (HTTP 426).
   * Un client qui n'envoie pas l'en-tête `x-app-version` n'est pas bloqué.
   */
  private isAppVersionSupported(req: Request, res: Response): boolean {
    const clientVersion = req.headers['x-app-version'];
    if (typeof clientVersion !== 'string') return true;

    if (compareVersions(clientVersion, this.minAppVersion) < 0) {
      this.reject(
        res,
        426,
        'APP_UPDATE_REQUIRED',
        `Version ${clientVersion} obsolète : la version minimale requise est ${this.minAppVersion}. Veuillez mettre à jour l'application.`,
      );
      return false;
    }
    return true;
  }

  private async checkTenant(
    payload: TokenPayload,
    res: Response,
  ): Promise<{ ok: true; allowedFeatures: string[] | null } | { ok: false }> {
    if (!payload.organisationId) {
      this.reject(res, 403, 'NO_ORGANISATION', "Aucune école n'est associée à ce compte.");
      return { ok: false };
    }

    const { verdict, allowedFeatures } = await this.tenantGate.check(payload.organisationId);
    switch (verdict) {
      case 'ok':
        return { ok: true, allowedFeatures };
      case 'suspended':
        this.reject(res, 403, 'TENANT_SUSPENDED', 'Votre établissement est suspendu. Contactez SMARTBUS pour régulariser votre abonnement.');
        return { ok: false };
      case 'inactive':
        this.reject(res, 403, 'TENANT_INACTIVE', "Votre établissement n'est pas encore activé.");
        return { ok: false };
      default:
        this.reject(res, 403, 'TENANT_NOT_FOUND', 'Établissement introuvable.');
        return { ok: false };
    }
  }

  private reject(res: Response, statusCode: number, code: string, message: string): void {
    res.status(statusCode).json({ statusCode, code, message });
  }
}
