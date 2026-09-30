import { SensPointage, sensFromPunchState } from './montee.entity';

/**
 * Conversion du `punch_state` BioTime en sens métier.
 *
 * Cette règle était dupliquée entre le traitement du flux et les notifications
 * parents, avec des tables de correspondance divergentes : un pointage pouvait
 * être compté comme une montée d'un côté et une descente de l'autre.
 */
describe('sensFromPunchState', () => {
  it('traite les codes de sortie ZKTeco comme des descentes', () => {
    // 1 Check-Out, 2 Break-Out, 5 OT-Out
    for (const code of ['1', '2', '5']) {
      expect(sensFromPunchState(code)).toBe(SensPointage.DESCENTE);
    }
  });

  it("traite les codes d'entrée ZKTeco comme des montées", () => {
    // 0 Check-In, 3 Break-In, 4 OT-In
    for (const code of ['0', '3', '4']) {
      expect(sensFromPunchState(code)).toBe(SensPointage.MONTEE);
    }
  });

  it("accepte un code numérique aussi bien qu'une chaîne", () => {
    expect(sensFromPunchState(1)).toBe(SensPointage.DESCENTE);
    expect(sensFromPunchState(0)).toBe(SensPointage.MONTEE);
  });

  it('tolère les espaces autour du code', () => {
    expect(sensFromPunchState(' 1 ')).toBe(SensPointage.DESCENTE);
  });

  it("retombe sur une montée quand la badgeuse n'annonce aucun état", () => {
    // Une valeur absente ne doit jamais faire planter l'ingestion.
    expect(sensFromPunchState(undefined)).toBe(SensPointage.MONTEE);
    expect(sensFromPunchState(null)).toBe(SensPointage.MONTEE);
    expect(sensFromPunchState('')).toBe(SensPointage.MONTEE);
    expect(sensFromPunchState('inconnu')).toBe(SensPointage.MONTEE);
  });
});
