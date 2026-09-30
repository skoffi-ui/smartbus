import { TENANT_ENTITIES } from './tenant-entity-list';
import * as lib from './index';

describe('TENANT_ENTITIES', () => {
  it('contient toutes les entités des bases école (provisionnement = connexion)', () => {
    const names = TENANT_ENTITIES.map((e) => e.name);

    // Tables absentes du provisionnement avant la liste unique
    for (const expected of [
      'Notification',
      'AlerteCritique',
      'Device',
      'DeviceAssignment',
      'BiometricConsent',
      'CourseExecution',
      'Pointage',
    ]) {
      expect(names).toContain(expected);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it('est exportée par la lib pour être partagée avec la SUPER APP', () => {
    expect(lib.TENANT_ENTITIES).toBe(TENANT_ENTITIES);
  });
});
