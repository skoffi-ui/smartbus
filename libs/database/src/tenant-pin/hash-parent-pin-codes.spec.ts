import { QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { hasherPinParent } from '@app/common/security/parent-pin';
import { HashParentPinCodes1728200000000 } from '../migrations/tenant/1728200000000-HashParentPinCodes';

describe('migration tenant HashParentPinCodes', () => {
  it('élargit la colonne et re-hashe le clair sans toucher un hash déjà en place', async () => {
    const hashDeja = await hasherPinParent('9999');
    const lignes = [
      { id: 'parent-clair', pin_code: '1234' },
      { id: 'parent-hash', pin_code: hashDeja },
    ];
    const appels: { sql: string; params?: unknown[] }[] = [];
    const queryRunner = {
      query: jest.fn((sql: string, params?: unknown[]) => {
        appels.push({ sql, params });
        if (sql.includes('SELECT')) return lignes;
        if (sql.includes('UPDATE')) {
          const hash = params?.[0];
          const id = params?.[1];
          const ligne = lignes.find((l) => l.id === id);
          if (ligne && typeof hash === 'string') ligne.pin_code = hash;
        }
        return [];
      }),
    };

    const migration = new HashParentPinCodes1728200000000();
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(appels[0].sql).toMatch(
      /ALTER TABLE "parents" ALTER COLUMN "pin_code" TYPE character varying\(255\)/,
    );
    expect(lignes[0].pin_code).not.toBe('1234');
    expect(lignes[0].pin_code.startsWith('$2b$12$')).toBe(true);
    expect(await bcrypt.compare('1234', lignes[0].pin_code)).toBe(true);
    expect(lignes[1].pin_code).toBe(hashDeja);
    expect(appels.filter((a) => a.sql.includes('UPDATE'))).toHaveLength(1);

    const apres = lignes[0].pin_code;
    await migration.up(queryRunner as unknown as QueryRunner);
    expect(lignes[0].pin_code).toBe(apres);
    expect(lignes[1].pin_code).toBe(hashDeja);
  });

  it('est irréversible', async () => {
    const migration = new HashParentPinCodes1728200000000();
    await expect(migration.down()).rejects.toThrow(/irréversible/);
  });
});
