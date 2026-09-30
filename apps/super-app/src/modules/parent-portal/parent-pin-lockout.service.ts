import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cleCompteParent,
  dureesVerrouPinMs,
  entierPositif,
} from './parent-auth.config';

export const HORLOGE_PARENT_PIN = 'HORLOGE_PARENT_PIN';

interface EtatVerrou {
  echecs: number;
  /** Nombre de verrouillages déjà déclenchés : index dans les durées progressives. */
  niveau: number;
  verrouilleJusqua: number;
}

/**
 * Verrouillage progressif par identifiant (école + email/téléphone), en
 * mémoire du processus. Distinct du throttler (plafond de requêtes) : ici
 * seuls les échecs d'authentification comptent, et la durée augmente à
 * chaque série.
 *
 * Non partagé entre plusieurs instances de super-app.
 */
@Injectable()
export class ParentPinLockoutService {
  private readonly etats = new Map<string, EtatVerrou>();

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(HORLOGE_PARENT_PIN)
    private readonly horloge?: () => number,
  ) {}

  assertPasVerrouille(schoolCode: string, emailOrPhone: string): void {
    const etat = this.etats.get(cleCompteParent(schoolCode, emailOrPhone));
    if (!etat) return;
    const maintenant = this.maintenant();
    if (etat.verrouilleJusqua > maintenant) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((etat.verrouilleJusqua - maintenant) / 1000),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'PARENT_PIN_LOCKED',
          message: 'Trop de tentatives. Réessayez plus tard.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  enregistrerEchec(schoolCode: string, emailOrPhone: string): void {
    const cle = cleCompteParent(schoolCode, emailOrPhone);
    const maintenant = this.maintenant();
    const etat = this.etats.get(cle) ?? {
      echecs: 0,
      niveau: 0,
      verrouilleJusqua: 0,
    };
    if (etat.verrouilleJusqua > maintenant) return;

    etat.echecs += 1;
    if (etat.echecs >= this.maxTentatives()) {
      const durees = dureesVerrouPinMs(this.config);
      const duree = durees[Math.min(etat.niveau, durees.length - 1)];
      etat.verrouilleJusqua = maintenant + duree;
      etat.niveau += 1;
      etat.echecs = 0;
    }
    this.etats.set(cle, etat);
  }

  reinitialiser(schoolCode: string, emailOrPhone: string): void {
    this.etats.delete(cleCompteParent(schoolCode, emailOrPhone));
  }

  private maxTentatives(): number {
    return entierPositif(this.config, 'PARENT_PIN_MAX_ATTEMPTS', 5);
  }

  private maintenant(): number {
    return this.horloge ? this.horloge() : Date.now();
  }
}
