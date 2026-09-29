import { ConfigService } from '@nestjs/config';
import {
  jwtRefreshSecretRequis,
  jwtSecretRequis,
  secretsJwtAuDemarrage,
} from './jwt-secret';

/** ConfigService minimal renvoyant la valeur fournie pour JWT_SECRET. */
function config(valeur?: string): ConfigService {
  return {
    get: (cle: string) => (cle === 'JWT_SECRET' ? valeur : undefined),
  } as ConfigService;
}

/** ConfigService minimal : une valeur par variable, rien d'autre. */
function configVars(
  valeurs: Record<string, string | undefined>,
): ConfigService {
  return { get: (cle: string) => valeurs[cle] } as ConfigService;
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

describe('jwtRefreshSecretRequis', () => {
  const SECRET_REFRESH = 'b'.repeat(64);

  it('rend le secret de rafraîchissement configuré', () => {
    expect(
      jwtRefreshSecretRequis(
        configVars({ JWT_REFRESH_SECRET: SECRET_REFRESH }),
      ),
    ).toBe(SECRET_REFRESH);
  });

  it("refuse de démarrer si JWT_REFRESH_SECRET est absent (aucune valeur de repli, y compris 'secret')", () => {
    expect(() => jwtRefreshSecretRequis(configVars({}))).toThrow(
      /JWT_REFRESH_SECRET est requis/,
    );
    expect(() =>
      jwtRefreshSecretRequis(configVars({ JWT_REFRESH_SECRET: '' })),
    ).toThrow(/JWT_REFRESH_SECRET est requis/);
    expect(() =>
      jwtRefreshSecretRequis(configVars({ JWT_REFRESH_SECRET: undefined })),
    ).toThrow(/JWT_REFRESH_SECRET est requis/);
  });

  it("refuse l'ancien repli 'secret' et l'exemple publié dans .env.example", () => {
    for (const repli of [
      'secret',
      'your_super_secret_refresh_key_change_in_production',
    ]) {
      expect(() =>
        jwtRefreshSecretRequis(configVars({ JWT_REFRESH_SECRET: repli })),
      ).toThrow(/valeur compromise/);
    }
  });

  it('refuse un secret de rafraîchissement trop court', () => {
    expect(() =>
      jwtRefreshSecretRequis(
        configVars({ JWT_REFRESH_SECRET: 'b'.repeat(31) }),
      ),
    ).toThrow(/trop court/);
    expect(
      jwtRefreshSecretRequis(
        configVars({ JWT_REFRESH_SECRET: 'b'.repeat(32) }),
      ),
    ).toHaveLength(32);
  });
});

describe('secretsJwtAuDemarrage', () => {
  const ACCES = 'a'.repeat(64);
  const REFRESH = 'b'.repeat(64);

  it("accepte les deux secrets et renvoie celui des jetons d'accès", () => {
    expect(
      secretsJwtAuDemarrage(
        configVars({ JWT_SECRET: ACCES, JWT_REFRESH_SECRET: REFRESH }),
      ),
    ).toBe(ACCES);
  });

  it("refuse le démarrage du module d'auth si JWT_REFRESH_SECRET manque", () => {
    expect(() =>
      secretsJwtAuDemarrage(configVars({ JWT_SECRET: ACCES })),
    ).toThrow(/JWT_REFRESH_SECRET est requis/);
  });

  it("refuse le démarrage du module d'auth si JWT_SECRET manque", () => {
    expect(() =>
      secretsJwtAuDemarrage(configVars({ JWT_REFRESH_SECRET: REFRESH })),
    ).toThrow(/JWT_SECRET est requis/);
  });
});
