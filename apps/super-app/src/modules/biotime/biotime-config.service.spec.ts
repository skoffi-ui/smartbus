import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '@app/common';
import { BiotimeConfigService } from './biotime-config.service';

const CLE = 'c'.repeat(64);
const ORG_A = 'org-aaaa-1111';
const ORG_B = 'org-bbbb-2222';

/**
 * Configuration BioTime par école.
 *
 * Avant, une seule URL et un seul couple d'identifiants existaient pour toute la
 * plateforme : le deuxième établissement ne pouvait pas être servi.
 */
describe('BiotimeConfigService', () => {
  let service: BiotimeConfigService;
  let crypto: CryptoService;
  let enregistrees: Record<string, any>;

  const configRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => {
      enregistrees[v.organisationId] = v;
      return v;
    }),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const orgRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      where.id === ORG_A
        ? { id: ORG_A, name: 'École A' }
        : where.id === ORG_B
          ? { id: ORG_B, name: 'École B' }
          : null,
    ),
  };

  beforeEach(() => {
    enregistrees = {};
    jest.clearAllMocks();
    configRepo.findOne.mockResolvedValue(null);
    crypto = new CryptoService({
      get: (k: string) => (k === 'ENCRYPTION_KEY' ? CLE : undefined),
    } as unknown as ConfigService);
    service = new BiotimeConfigService(
      configRepo as any,
      orgRepo as any,
      crypto,
    );
  });

  it('chiffre le mot de passe et ne le renvoie jamais', async () => {
    const publique = await service.enregistrer(ORG_A, {
      url: 'http://192.168.1.50:8080',
      username: 'admin',
      password: 'secret-ecole-A',
    });

    expect(JSON.stringify(publique)).not.toContain('secret-ecole-A');
    expect(publique).not.toHaveProperty('password');

    const stockee = enregistrees[ORG_A];
    expect(stockee.passwordCiphertext).toBeTruthy();
    expect(stockee.passwordCiphertext).not.toContain('secret-ecole-A');
    expect(
      crypto.dechiffrer({
        ciphertext: stockee.passwordCiphertext,
        iv: stockee.passwordIv,
        tag: stockee.passwordTag,
      }),
    ).toBe('secret-ecole-A');
  });

  it('garde des identifiants distincts pour deux écoles', async () => {
    await service.enregistrer(ORG_A, {
      url: 'http://192.168.1.50:8080',
      username: 'admin-a',
      password: 'secret-A',
    });
    await service.enregistrer(ORG_B, {
      url: 'http://10.0.0.20:8080',
      username: 'admin-b',
      password: 'secret-B',
    });

    const lire = (org: string) => {
      const c = enregistrees[org];
      return {
        url: c.url,
        username: c.username,
        password: crypto.dechiffrer({
          ciphertext: c.passwordCiphertext,
          iv: c.passwordIv,
          tag: c.passwordTag,
        }),
      };
    };

    expect(lire(ORG_A)).toEqual({
      url: 'http://192.168.1.50:8080',
      username: 'admin-a',
      password: 'secret-A',
    });
    expect(lire(ORG_B)).toEqual({
      url: 'http://10.0.0.20:8080',
      username: 'admin-b',
      password: 'secret-B',
    });
  });

  it("conserve le mot de passe existant quand il n'est pas resaisi", async () => {
    const existante = {
      organisationId: ORG_A,
      url: 'http://ancienne:8080',
      username: 'admin',
      passwordCiphertext: 'CHIFFRE',
      passwordIv: 'IV',
      passwordTag: 'TAG',
      isActive: true,
    };
    configRepo.findOne.mockResolvedValue(existante);

    await service.enregistrer(ORG_A, {
      url: 'http://nouvelle:9090',
      username: 'admin2',
    });

    expect(enregistrees[ORG_A].url).toBe('http://nouvelle:9090');
    expect(enregistrees[ORG_A].username).toBe('admin2');
    expect(enregistrees[ORG_A].passwordCiphertext).toBe('CHIFFRE');
  });

  it('exige un mot de passe à la première configuration', async () => {
    await expect(
      service.enregistrer(ORG_A, { url: 'http://x:8080', username: 'admin' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse une URL sans schéma', async () => {
    await expect(
      service.enregistrer(ORG_A, {
        url: '192.168.1.50:8080',
        username: 'a',
        password: 'p',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("normalise la barre oblique finale de l'URL", async () => {
    await service.enregistrer(ORG_A, {
      url: 'http://192.168.1.50:8080/',
      username: 'admin',
      password: 'p',
    });

    expect(enregistrees[ORG_A].url).toBe('http://192.168.1.50:8080');
  });

  it('refuse une école inexistante', async () => {
    await expect(
      service.enregistrer('org-inconnue', {
        url: 'http://x:8080',
        username: 'a',
        password: 'p',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuse de fournir des identifiants pour une école non configurée', async () => {
    configRepo.findOne.mockResolvedValue(null);

    await expect(service.obtenirIdentifiants(ORG_B)).rejects.toThrow(
      NotFoundException,
    );
  });
});
