import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation, OrganisationStatus, TENANT_ACCESS_STATUSES } from '@app/database';

export type TenantVerdict = 'ok' | 'not_found' | 'suspended' | 'inactive';

export interface TenantCheckResult {
  verdict: TenantVerdict;
  /**
   * Permissions par école (voir `Organisation.allowedFeatures`), lues fraîchement
   * ici plutôt que depuis le JWT : sans ça, un compte directeur déjà connecté
   * garderait ses anciennes permissions (voire un accès total si le jeton a été
   * émis avant toute restriction) jusqu'à l'expiration du jeton — jusqu'à 7 jours.
   * `null` = aucune restriction.
   */
  allowedFeatures: string[] | null;
}

interface CacheEntry {
  result: TenantCheckResult;
  expiresAt: number;
}

/**
 * Vérifie le statut ET les permissions d'une école dans la base centrale avant de
 * router vers l'APP école. Le résultat est mis en cache quelques secondes pour ne
 * pas interroger la base à chaque requête ; une suspension ou un changement de
 * permissions prend donc effet en au plus `TTL_MS`, plutôt que d'attendre
 * l'expiration du jeton d'accès (voir `GatewayService.checkTenant` et l'en-tête
 * de confiance `x-allowed-features` qu'il pose sur la requête relayée à l'école).
 */
@Injectable()
export class TenantGateService {
  static readonly TTL_MS = 15_000;

  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
  ) {}

  async check(organisationId: string): Promise<TenantCheckResult> {
    const cached = this.cache.get(organisationId);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const org = await this.organisations.findOne({
      where: { id: organisationId },
      select: { id: true, status: true, allowedFeatures: true },
    });

    let verdict: TenantVerdict;
    if (!org) verdict = 'not_found';
    else if (TENANT_ACCESS_STATUSES.includes(org.status)) verdict = 'ok';
    else if (org.status === OrganisationStatus.SUSPENDED) verdict = 'suspended';
    else verdict = 'inactive';

    const result: TenantCheckResult = { verdict, allowedFeatures: org?.allowedFeatures ?? null };
    this.cache.set(organisationId, { result, expiresAt: Date.now() + TenantGateService.TTL_MS });
    return result;
  }

  /** Invalide le cache (utile aux tests, et après une mise à jour des permissions). */
  clear(): void {
    this.cache.clear();
  }
}
