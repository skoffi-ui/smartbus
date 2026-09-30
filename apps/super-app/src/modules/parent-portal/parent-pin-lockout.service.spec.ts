import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParentPinLockoutService } from './parent-pin-lockout.service';

describe('ParentPinLockoutService', () => {
  const config = {
    get: (cle: string, defaut?: string) => {
      const valeurs: Record<string, string> = {
        PARENT_PIN_MAX_ATTEMPTS: '2',
        PARENT_PIN_LOCK_STEPS_SEC: '60,300',
      };
      return valeurs[cle] ?? defaut;
    },
  } as unknown as ConfigService;

  it('verrouille après N échecs, puis plus longtemps à la série suivante', () => {
    let maintenant = 1_000_000;
    const service = new ParentPinLockoutService(config, () => maintenant);
    const ecole = 'ECOLE1';
    const identifiant = 'Parent@Ecole.ci';

    service.enregistrerEchec(ecole, identifiant);
    service.assertPasVerrouille(ecole, '  parent@ecole.ci  ');

    service.enregistrerEchec(ecole, identifiant);
    expect(() => service.assertPasVerrouille(ecole, identifiant)).toThrow(
      HttpException,
    );

    try {
      service.assertPasVerrouille(ecole, identifiant);
    } catch (err) {
      const reponse = (err as HttpException).getResponse() as {
        code: string;
        retryAfterSeconds: number;
      };
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(reponse.code).toBe('PARENT_PIN_LOCKED');
      expect(reponse.retryAfterSeconds).toBe(60);
    }

    maintenant += 60_000;
    service.assertPasVerrouille(ecole, identifiant);

    service.enregistrerEchec(ecole, identifiant);
    service.enregistrerEchec(ecole, identifiant);
    maintenant += 60_000;
    expect(() => service.assertPasVerrouille(ecole, identifiant)).toThrow(
      HttpException,
    );

    maintenant += 300_000;
    service.assertPasVerrouille(ecole, identifiant);
  });

  it('ne verrouille pas un autre identifiant et oublie les échecs après une réussite', () => {
    const service = new ParentPinLockoutService(config, () => 0);
    service.enregistrerEchec('ECOLE1', 'a@b.c');
    service.reinitialiser('ecole1', 'A@B.C');
    service.enregistrerEchec('ECOLE1', 'a@b.c');
    service.assertPasVerrouille('ECOLE1', 'a@b.c');
    service.enregistrerEchec('ECOLE1', 'autre@b.c');
    service.assertPasVerrouille('ECOLE1', 'autre@b.c');
  });
});
