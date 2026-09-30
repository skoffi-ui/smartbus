import { ConfigService } from '@nestjs/config';
import { jwtSecretRequis } from './jwt-secret';

/** ConfigService minimal renvoyant la valeur fournie pour JWT_SECRET. */
function config(valeur?: string): ConfigService {
  return {
    get: (cle: string) => (cle === 'JWT_SECRET' ? valeur : undefined),
  } as ConfigService;
}

const SECRET_VALIDE = 'a'.repeat(64);

describe('jwtSecretRequis', () => {
  it('rend le secret configuré', () => {
    expect(jwtSecretRequis(config(SECRET_VALIDE))).toBe(SECRET_VALIDE);
  });

  it("refuse de démarrer si JWT_SECRET est absent (aucune valeur de repli n'est sûre)", () => {
    expect(() => jwtSecretRequis(config(undefined))).toThrow(
      /JWT_SECRET est requis/,
    );
    expect(() => jwtSecretRequis(config(''))).toThrow(/JWT_SECRET est requis/);
  });

  it('refuse les anciennes valeurs de repli codées en dur', () => {
    // Ce sont les valeurs qui traînaient dans le code : 'secret' côté super-app,
    // la phrase « change_in_production » côté app école. Si l'une d'elles revient,
    // ce test doit tomber.
    for (const repli of [
      'secret',
      'your_super_secret_jwt_key_change_in_production',
    ]) {
      expect(() => jwtSecretRequis(config(repli))).toThrow(/valeur compromise/);
    }
  });

  it('refuse un secret trop court pour être résistant', () => {
    expect(() => jwtSecretRequis(config('a'.repeat(31)))).toThrow(/trop court/);
    expect(jwtSecretRequis(config('a'.repeat(32)))).toHaveLength(32);
  });
});
