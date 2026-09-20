import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation, OrganisationStatus, TENANT_ACCESS_STATUSES } from '@app/database';

export type TenantVerdict = 'ok' | 'not_found' | 'suspended' | 'inactive';

interface CacheEntry {
  verdict: TenantVerdict;
  expiresAt: number;
}

/**
 * Vérifie le statut d'une école dans la base centrale avant de router vers l'APP école.
 * Le verdict est mis en cache quelques secondes pour ne pas interroger la base à chaque requête ;
 * une suspension prend donc effet en au plus `TTL_MS`.
 */
@Injectable()
export class TenantGateService {
  static readonly TTL_MS = 15_000;

  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
  ) {}

  async check(organisationId: string): Promise<TenantVerdict> {
    const cached = this.cache.get(organisationId);
    if (cached && cached.expiresAt > Date.now()) return cached.verdict;

    const org = await this.organisations.findOne({
      where: { id: organisationId },
      select: { id: true, status: true },
    });

    let verdict: TenantVerdict;
    if (!org) verdict = 'not_found';
    else if (TENANT_ACCESS_STATUSES.includes(org.status)) verdict = 'ok';
    else if (org.status === OrganisationStatus.SUSPENDED) verdict = 'suspended';
    else verdict = 'inactive';

    this.cache.set(organisationId, { verdict, expiresAt: Date.now() + TenantGateService.TTL_MS });
    return verdict;
  }

  /** Invalide le cache (utile aux tests). */
  clear(): void {
    this.cache.clear();
  }
}
