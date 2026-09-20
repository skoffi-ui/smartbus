import { MonteeStatut, SensPointage } from '@app/database';
import { HardwareStreamService } from './hardware-stream.service';

/**
 * Consignation d'un badgeage dans l'historique de l'école (table `montees`).
 *
 * Avant, cette table n'était jamais alimentée : la seule chaîne qui y écrivait
 * était déclenchée par un endpoint que rien n'appelait. L'écran « Suivi des
 * montées » était donc vide par construction.
 */
describe('Badgeage → historique des montées', () => {
  const ORG = 'org-aaaa-1111';

  let service: HardwareStreamService;
  let monteeRepo: { create: jest.Mock; save: jest.Mock };
  let saved: any[];

  const child: any = { id: 'child-1', firstName: 'Awa', lastName: 'Koné', empCode: '42' };
  const course: any = { id: 'course-1', nom: 'Aller Matin', trajetId: 'trajet-1' };
  const car: any = { id: 'car-1', plateNumber: 'AA-001' };

  beforeEach(() => {
    saved = [];
    monteeRepo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => {
        saved.push(v);
        return v;
      }),
    };

    service = new HardwareStreamService(
      { find: jest.fn() } as any,
      { query: jest.fn() } as any,
      { get: (_k: string, d?: any) => d } as any,
      {} as any,
      { emit: jest.fn() } as any,
    );
  });

  const dataSource: any = { getRepository: () => monteeRepo };

  const saveMontee = (sens: SensPointage, verdict: any, carArg: any = car) =>
    (service as any).saveMontee(
      dataSource,
      child,
      course,
      carArg,
      sens,
      verdict,
      '2026-09-20T07:45:30.000Z',
    );

  it('enregistre une montée validée avec son arrêt et sa distance', async () => {
    await saveMontee(SensPointage.MONTEE, {
      statut: MonteeStatut.VALIDE,
      message: 'Pointage conforme.',
      pointId: 'point-1',
      distanceMetres: 18,
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      childId: 'child-1',
      courseId: 'course-1',
      carId: 'car-1',
      pointId: 'point-1',
      sens: SensPointage.MONTEE,
      statut: MonteeStatut.VALIDE,
      distanceGps: 18,
      validationMessage: 'Pointage conforme.',
    });
  });

  it('distingue une descente d\'une montée', async () => {
    await saveMontee(SensPointage.DESCENTE, {
      statut: MonteeStatut.VALIDE,
      message: 'Descente conforme.',
      pointId: 'point-1',
    });

    expect(saved[0].sens).toBe(SensPointage.DESCENTE);
  });

  it('consigne aussi les pointages refusés, avec leur motif', async () => {
    await saveMontee(SensPointage.MONTEE, {
      statut: MonteeStatut.REFUSE,
      message: 'Mauvais bus.',
      pointId: 'point-1',
      distanceMetres: 1400,
    });

    expect(saved[0]).toMatchObject({
      statut: MonteeStatut.REFUSE,
      validationMessage: 'Mauvais bus.',
      distanceGps: 1400,
    });
  });

  it("extrait l'heure du moment du badgeage, pas de l'heure courante", async () => {
    await saveMontee(SensPointage.MONTEE, { statut: MonteeStatut.VALIDE, message: 'ok' });

    expect(saved[0].heure).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(saved[0].date).toEqual(new Date('2026-09-20T07:45:30.000Z'));
  });

  it('accepte un badgeage sans car identifié sans planter', async () => {
    await saveMontee(SensPointage.MONTEE, { statut: MonteeStatut.VALIDE, message: 'ok' }, null);

    expect(saved[0].carId).toBeUndefined();
  });

  it("n'interrompt pas l'ingestion si l'écriture échoue", async () => {
    monteeRepo.save.mockRejectedValue(new Error('base indisponible'));

    // L'événement biométrique et l'alerte sont déjà enregistrés en amont :
    // un échec de consignation ne doit pas faire échouer le flux matériel.
    await expect(
      saveMontee(SensPointage.MONTEE, { statut: MonteeStatut.VALIDE, message: 'ok' }),
    ).resolves.toBeUndefined();
  });
});
