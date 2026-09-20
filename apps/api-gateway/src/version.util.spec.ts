import { compareVersions } from './version.util';

describe('compareVersions', () => {
  it('compare numériquement, pas alphabétiquement', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.5', '2.1.0')).toBeLessThan(0);
  });

  it('considère les segments manquants comme 0', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });

  it('retourne NaN pour une version invalide (jamais < 0)', () => {
    expect(compareVersions('abc', '1.0.0')).toBeNaN();
    expect(Number.NaN < 0).toBe(false);
  });
});
