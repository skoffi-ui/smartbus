import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const CLE = 'a'.repeat(64); // 32 octets en hexadécimal

function service(cle?: string): CryptoService {
  return new CryptoService({
    get: (clef: string) => (clef === 'ENCRYPTION_KEY' ? cle : undefined),
  } as unknown as ConfigService);
}

describe('CryptoService', () => {
  it('restitue exactement le secret chiffré', () => {
    const s = service(CLE);
    const secret = s.chiffrer('mot-de-passe-biotime');

    expect(s.dechiffrer(secret)).toBe('mot-de-passe-biotime');
  });

  it('ne laisse jamais apparaître le secret en clair', () => {
    const s = service(CLE);
    const secret = s.chiffrer('SuperSecret123');

    expect(secret.ciphertext).not.toContain('SuperSecret123');
    expect(JSON.stringify(secret)).not.toContain('SuperSecret123');
  });

  it('produit un chiffré différent à chaque fois, même pour la même valeur', () => {
    const s = service(CLE);
    const a = s.chiffrer('identique');
    const b = s.chiffrer('identique');

    // Vecteur d'initialisation aléatoire : deux écoles avec le même mot de passe
    // ne doivent pas être reconnaissables en base.
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(s.dechiffrer(a)).toBe('identique');
    expect(s.dechiffrer(b)).toBe('identique');
  });

  it('accepte les caractères accentués et les symboles', () => {
    const s = service(CLE);
    const valeur = 'Mot dé passé #2026 àéîôù §';

    expect(s.dechiffrer(s.chiffrer(valeur))).toBe(valeur);
  });

  it("détecte une donnée altérée en base au lieu de renvoyer n'importe quoi", () => {
    const s = service(CLE);
    const secret = s.chiffrer('mot-de-passe');

    const altere = {
      ...secret,
      ciphertext: Buffer.from('donnee-falsifiee').toString('base64'),
    };
    expect(() => s.dechiffrer(altere)).toThrow(InternalServerErrorException);
  });

  it('refuse de déchiffrer avec une autre clé', () => {
    const secret = service(CLE).chiffrer('mot-de-passe');
    const autre = service('b'.repeat(64));

    expect(() => autre.dechiffrer(secret)).toThrow(
      InternalServerErrorException,
    );
  });

  it('exige une clé, avec un message actionnable', () => {
    const s = service(undefined);

    expect(s.estConfigure()).toBe(false);
    expect(() => s.chiffrer('x')).toThrow(/ENCRYPTION_KEY/);
  });

  it('refuse une clé de longueur incorrecte', () => {
    const s = service('abcd');

    expect(s.estConfigure()).toBe(false);
    expect(() => s.chiffrer('x')).toThrow(/32 octets/);
  });
});
