import { Injectable, Scope, Inject, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Organisation, TenantConnectionService } from '@app/database';

@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @Inject(REQUEST) private readonly request: any,
    @InjectRepository(Organisation)
    public readonly organisationRepository: Repository<Organisation>,
    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

  /**
   * Retourne l'ID du Tenant actuel. L'identité issue du JWT vérifié prime toujours ;
   * le header 'x-tenant-id' n'est qu'un repli pour les appels sans session (webhooks internes).
   */
  getTenantId(): string | null {
    if (this.request?.user?.organisationId) {
      return this.request.user.organisationId;
    }
    if (this.request?.headers) {
      return (
        this.request.headers['x-tenant-id'] ||
        this.request.headers['x-tenant-schema'] ||
        null
      );
    }
    return null;
  }

  /**
   * Retourne la connexion TypeORM (DataSource) exclusive pour l'école actuelle.
   */
  async getDataSource(tenantIdOverride?: string): Promise<DataSource> {
    return this.tenantConnectionService.getTenantConnection(tenantIdOverride);
  }

  /**
   * Retourne dynamiquement l'ID de la première école (utile pour les webhooks sans session)
   */
  async getFirstOrganisationId(): Promise<string | null> {
    const org = await this.organisationRepository.findOne({
      where: {}, // Requis par TypeORM 0.3+ pour findOne
      order: { createdAt: 'DESC' },
    });
    return org ? org.id : null;
  }
}
