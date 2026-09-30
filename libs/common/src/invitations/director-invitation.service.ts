import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { jwtSecretRequis } from '../config/jwt-secret';

const INVITATION_PURPOSE = 'director_invite';
const DUREE_VALIDITE = '7d';

interface JetonInvitationDirecteur {
  purpose: typeof INVITATION_PURPOSE;
  organisationId: string;
}

/**
 * Invitation à devenir directeur d'une école précise — sans base de données :
 * un simple JWT signé portant `organisationId`, vérifié à la volée. Un
 * directeur n'existe (`User`) qu'au moment où il s'inscrit lui-même avec ce
 * jeton (voir AuthService.rejoindreEcole) — avant ça, rien n'est stocké nulle
 * part, il n'y a donc rien à faire expirer ni à nettoyer en base.
 *
 * `purpose` empêche qu'un jeton d'accès/rafraîchissement normal (même secret)
 * ne soit accepté ici par erreur.
 *
 * Compromis assumé : ce jeton n'est pas à usage unique (rien n'est marqué
 * "consommé" puisqu'il n'y a pas de ligne à mettre à jour) — il reste valable
 * pour toute inscription vers cette école jusqu'à son expiration (7 jours).
 * Cohérent avec "une école peut avoir plusieurs directeurs", mais veut dire
 * qu'un lien qui fuite reste utilisable jusqu'à expiration : à transmettre
 * comme tout lien sensible.
 */
@Injectable()
export class DirectorInvitationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signer(organisationId: string): Promise<string> {
    const payload: JetonInvitationDirecteur = {
      purpose: INVITATION_PURPOSE,
      organisationId,
    };
    return this.jwtService.signAsync(payload, {
      secret: jwtSecretRequis(this.configService),
      expiresIn: DUREE_VALIDITE,
    });
  }

  /** Vérifie le jeton et renvoie l'`organisationId` qu'il porte, ou lève une erreur claire. */
  async verifier(token: string): Promise<string> {
    let payload: JetonInvitationDirecteur;
    try {
      payload = await this.jwtService.verifyAsync<JetonInvitationDirecteur>(
        token,
        {
          secret: jwtSecretRequis(this.configService),
        },
      );
    } catch {
      throw new BadRequestException(
        "Ce lien d'invitation est invalide ou a expiré.",
      );
    }
    if (payload.purpose !== INVITATION_PURPOSE || !payload.organisationId) {
      throw new BadRequestException("Ce lien d'invitation est invalide.");
    }
    return payload.organisationId;
  }
}
