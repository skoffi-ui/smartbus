import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Organisation,
  OrganisationStatus,
  Payment,
  SandboxPaymentStatus,
  Subscription,
  SubscriptionStatus,
} from '@app/database';
import * as crypto from 'crypto';
import { createRequire } from 'node:module';
import type { Response } from 'supertest';
import { CinetpayService } from './cinetpay.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JETON_SECRET_WEBHOOK_PAIEMENT } from './payment-webhook.constants';
import { PaymentWebhookGuard } from './payment-webhook.guard';

// supertest est CommonJS. Sans esModuleInterop, `import request from` se compile
// en `.default` et n'est pas une fonction à l'exécution.
interface AppelHttp extends PromiseLike<Response> {
  set(nom: string, valeur: string): AppelHttp;
  query(params: Record<string, string>): AppelHttp;
  send(corps: Record<string, unknown>): AppelHttp;
  expect(statut: number): Promise<Response>;
}

const charger = createRequire(__filename);
const request = charger('supertest') as (serveur: object) => {
  post(url: string): AppelHttp;
};

function messageDe(corps: unknown): string {
  const messages = messagesDe(corps);
  return messages.length === 1 ? messages[0] : '';
}

function messagesDe(corps: unknown): string[] {
  if (typeof corps !== 'object' || corps === null || !('message' in corps)) {
    return [];
  }
  const message = corps.message;
  if (typeof message === 'string') return [message];
  if (!Array.isArray(message)) return [];
  const textes: string[] = [];
  for (const item of message) {
    if (typeof item !== 'string') return [];
    textes.push(item);
  }
  return textes;
}

function codeDe(corps: unknown): number | undefined {
  if (typeof corps !== 'object' || corps === null || !('statusCode' in corps)) {
    return undefined;
  }
  const code = corps.statusCode;
  return typeof code === 'number' ? code : undefined;
}

const SECRET = 'a'.repeat(48);
const PAIEMENT_ID = '11111111-1111-4111-8111-111111111111';
const TRANSACTION_ID = 'TX-9F3A';

interface AbonnementFixe {
  id: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
}

interface OrganisationFixe {
  id: string;
  name: string;
  status: OrganisationStatus;
}

interface PaiementFixe {
  id: string;
  amount: number | string;
  currency: string;
  status: SandboxPaymentStatus;
  externalReference: string | null;
  subscription: AbonnementFixe;
  organisation: OrganisationFixe;
}

describe('POST /api/v1/payments/webhook (TD-002)', () => {
  let app: INestApplication;
  let paiement: PaiementFixe;
  let abonnement: AbonnementFixe;
  let organisation: OrganisationFixe;
  let findOne: jest.Mock;
  let transaction: jest.Mock;
  let save: jest.Mock;

  const reinitialiser = () => {
    abonnement = {
      id: '22222222-2222-4222-8222-222222222222',
      status: SubscriptionStatus.PENDING,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-01T00:00:00.000Z'),
    };
    organisation = {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'École des Palmiers',
      status: OrganisationStatus.SUSPENDED,
    };
    // Chaîne, comme un decimal TypeORM relu depuis Postgres.
    paiement = {
      id: PAIEMENT_ID,
      amount: '50000.00',
      currency: 'FCFA',
      status: SandboxPaymentStatus.PENDING,
      externalReference: 'OMN_ABC',
      subscription: abonnement,
      organisation,
    };
  };

  const notifier = (corps: Record<string, unknown>, secret?: string) => {
    const serveur: object = app.getHttpServer() as object;
    const appel = request(serveur).post('/api/v1/payments/webhook');
    if (secret !== undefined) {
      appel.set('x-cinetpay-webhook-secret', secret);
    }
    return appel.send(corps);
  };

  const corpsConforme = (remplace: Record<string, unknown> = {}) => ({
    paymentId: PAIEMENT_ID,
    status: 'success',
    transactionId: TRANSACTION_ID,
    amount: 50000,
    currency: 'FCFA',
    ...remplace,
  });

  beforeAll(async () => {
    reinitialiser();

    findOne = jest.fn(() => Promise.resolve(paiement));
    save = jest.fn((entite: unknown) => Promise.resolve(entite));
    const update = jest.fn(
      (
        _entite: unknown,
        criteres: { id: string; status: SandboxPaymentStatus },
        patch: Partial<PaiementFixe>,
      ) => {
        if (
          paiement.id === criteres.id &&
          paiement.status === criteres.status
        ) {
          Object.assign(paiement, patch);
          return Promise.resolve({ affected: 1 });
        }
        return Promise.resolve({ affected: 0 });
      },
    );
    const manager = { update, save };
    transaction = jest.fn((travail: (em: typeof manager) => Promise<void>) =>
      travail(manager),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        CinetpayService,
        PaymentWebhookGuard,
        { provide: PaymentsService, useValue: {} },
        { provide: JETON_SECRET_WEBHOOK_PAIEMENT, useValue: SECRET },
        {
          provide: getRepositoryToken(Payment),
          useValue: { findOne, manager: { transaction } },
        },
        { provide: getRepositoryToken(Subscription), useValue: {} },
        { provide: getRepositoryToken(Organisation), useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    reinitialiser();
    findOne.mockClear();
    transaction.mockClear();
    save.mockClear();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('refuse la notification sans secret', async () => {
    const reponse = await notifier(corpsConforme()).expect(401);

    expect(messageDe(reponse.body)).toMatch(/non autorisé/);
    expect(findOne).not.toHaveBeenCalled();
    expect(paiement.status).toBe(SandboxPaymentStatus.PENDING);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  it('refuse un secret invalide', async () => {
    const reponse = await notifier(corpsConforme(), 'b'.repeat(48)).expect(401);

    expect(messageDe(reponse.body)).toMatch(/non autorisé/);
    expect(findOne).not.toHaveBeenCalled();
    expect(abonnement.status).toBe(SubscriptionStatus.PENDING);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  it('refuse un corps incomplet (DTO class-validator)', async () => {
    await notifier(
      {
        paymentId: PAIEMENT_ID,
        status: 'success',
        transactionId: TRANSACTION_ID,
      },
      SECRET,
    ).expect(400);

    expect(findOne).not.toHaveBeenCalled();
    expect(paiement.status).toBe(SandboxPaymentStatus.PENDING);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  it('refuse un montant différent du paiement PENDING', async () => {
    const reponse = await notifier(corpsConforme({ amount: 1 }), SECRET).expect(
      400,
    );

    expect(messageDe(reponse.body)).toMatch(/montant ou la devise/);
    expect(transaction).not.toHaveBeenCalled();
    expect(paiement.status).toBe(SandboxPaymentStatus.PENDING);
    expect(abonnement.status).toBe(SubscriptionStatus.PENDING);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  it('refuse une devise différente du paiement PENDING', async () => {
    const reponse = await notifier(
      corpsConforme({ currency: 'EUR' }),
      SECRET,
    ).expect(400);

    expect(reponse.status).toBe(400);
    expect(codeDe(reponse.body)).toBe(400);
    expect(messageDe(reponse.body)).toBe(
      'Le montant ou la devise ne correspond pas au paiement en attente.',
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(paiement.status).toBe(SandboxPaymentStatus.PENDING);
    expect(paiement.externalReference).toBe('OMN_ABC');
    expect(abonnement.status).toBe(SubscriptionStatus.PENDING);
    expect(abonnement.endDate.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  it("enregistre un échec notifié sans réactiver l'école", async () => {
    const reponse = await notifier(
      corpsConforme({ status: 'failed', transactionId: 'TX-FAIL' }),
      SECRET,
    ).expect(200);

    expect(reponse.body).toEqual({ success: true });
    expect(paiement.status).toBe(SandboxPaymentStatus.FAILED);
    expect(paiement.externalReference).toBe('TX-FAIL');
    expect(abonnement.status).toBe(SubscriptionStatus.EXPIRED);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  it("refuse le rejeu d'une transaction déjà traitée sans prolonger une seconde fois", async () => {
    const premiere = await notifier(corpsConforme(), SECRET).expect(200);

    expect(premiere.body).toEqual({ success: true });
    expect(paiement.status).toBe(SandboxPaymentStatus.SUCCESS);
    expect(paiement.externalReference).toBe(TRANSACTION_ID);
    expect(abonnement.status).toBe(SubscriptionStatus.ACTIVE);
    expect(organisation.status).toBe(OrganisationStatus.ACTIVE);
    const finApresPremiere = abonnement.endDate.getTime();
    const debutApresPremiere = abonnement.startDate.getTime();
    expect(finApresPremiere).not.toBe(
      new Date('2026-01-01T00:00:00.000Z').getTime(),
    );
    expect(save).toHaveBeenCalledTimes(2);

    save.mockClear();
    const rejeu = await notifier(corpsConforme(), SECRET).expect(409);

    expect(messageDe(rejeu.body)).toMatch(/déjà été traitée/);
    expect(save).not.toHaveBeenCalled();
    expect(abonnement.status).toBe(SubscriptionStatus.ACTIVE);
    expect(abonnement.endDate.getTime()).toBe(finApresPremiere);
    expect(abonnement.startDate.getTime()).toBe(debutApresPremiere);
    expect(organisation.status).toBe(OrganisationStatus.ACTIVE);
    expect(paiement.status).toBe(SandboxPaymentStatus.SUCCESS);
  });

  it("refuse le secret passé en query string à la place de l'en-tête", async () => {
    const serveur: object = app.getHttpServer() as object;
    const reponse = await request(serveur)
      .post('/api/v1/payments/webhook')
      .query({
        'x-cinetpay-webhook-secret': SECRET,
        key: SECRET,
      })
      .send(corpsConforme())
      .expect(401);

    expect(reponse.status).toBe(401);
    expect(codeDe(reponse.body)).toBe(401);
    expect(messageDe(reponse.body)).toBe('Webhook de paiement non autorisé.');
    expect(findOne).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(paiement.status).toBe(SandboxPaymentStatus.PENDING);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  it('refuse un secret de longueur différente sans appeler timingSafeEqual', async () => {
    const espion = jest.spyOn(crypto, 'timingSafeEqual');
    const originale = transaction.getMockImplementation();
    try {
      await notifier(corpsConforme(), 'b'.repeat(SECRET.length)).expect(401);
      expect(espion).toHaveBeenCalledTimes(1);
      espion.mockClear();

      const reponse = await notifier(
        corpsConforme(),
        SECRET.slice(0, -1),
      ).expect(401);

      expect(reponse.status).toBe(401);
      expect(codeDe(reponse.body)).toBe(401);
      expect(messageDe(reponse.body)).toBe('Webhook de paiement non autorisé.');
      expect(espion).not.toHaveBeenCalled();
      expect(findOne).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    } finally {
      espion.mockRestore();
      if (originale) transaction.mockImplementation(originale);
    }
  });

  it('répond 404 lorsque le paiement est introuvable', async () => {
    findOne.mockResolvedValueOnce(null);

    const reponse = await notifier(corpsConforme(), SECRET).expect(404);

    expect(reponse.status).toBe(404);
    expect(codeDe(reponse.body)).toBe(404);
    expect(messageDe(reponse.body)).toBe('Paiement introuvable');
    expect(transaction).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(paiement.status).toBe(SandboxPaymentStatus.PENDING);
    expect(abonnement.status).toBe(SubscriptionStatus.PENDING);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  // Statut hors `success` / `failed` : rejeté par le DTO (@IsIn) avant le
  // service. Le paiement n'est ni soldé ni marqué en échec. class-validator
  // renvoie son message anglais par défaut (pas de factory Nest personnalisée).
  it('refuse un statut hors success et failed', async () => {
    const reponse = await notifier(
      corpsConforme({ status: 'cancelled' }),
      SECRET,
    ).expect(400);

    expect(reponse.status).toBe(400);
    expect(codeDe(reponse.body)).toBe(400);
    expect(messagesDe(reponse.body)).toEqual([
      'status must be one of the following values: success, failed',
    ]);
    expect(findOne).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(paiement.status).toBe(SandboxPaymentStatus.PENDING);
    expect(abonnement.status).toBe(SubscriptionStatus.PENDING);
    expect(organisation.status).toBe(OrganisationStatus.SUSPENDED);
  });

  // Les deux appels observent encore PENDING, puis la mise à jour conditionnelle
  // (`status = PENDING`) n'en laisse passer qu'une. L'autre reçoit 409.
  it('ne prolonge qu’une fois lorsque deux webhooks identiques arrivent ensemble', async () => {
    type Travail = (em: unknown) => Promise<void>;
    const originale = transaction.getMockImplementation() as
      | ((travail: Travail) => Promise<void>)
      | undefined;
    transaction.mockImplementation(
      (travail: Travail): Promise<void> =>
        new Promise<void>((resoudre) => {
          setImmediate(resoudre);
        }).then(() => originale?.(travail) ?? Promise.resolve()),
    );

    try {
      const [gauche, droite] = await Promise.all([
        notifier(corpsConforme(), SECRET),
        notifier(corpsConforme(), SECRET),
      ]);
      const statuts = [gauche.status, droite.status].sort((a, b) => a - b);
      const gagnant = gauche.status === 200 ? gauche : droite;
      const perdant = gauche.status === 409 ? gauche : droite;

      expect(statuts).toEqual([200, 409]);
      expect(gagnant.body).toEqual({ success: true });
      expect(perdant.status).toBe(409);
      expect(codeDe(perdant.body)).toBe(409);
      expect(messageDe(perdant.body)).toBe(
        "Cette transaction a déjà été traitée : l'abonnement n'est pas prolongé une seconde fois.",
      );
      expect(save).toHaveBeenCalledTimes(2);
      expect(paiement.status).toBe(SandboxPaymentStatus.SUCCESS);
      expect(paiement.externalReference).toBe(TRANSACTION_ID);
      expect(abonnement.status).toBe(SubscriptionStatus.ACTIVE);
      expect(organisation.status).toBe(OrganisationStatus.ACTIVE);
    } finally {
      if (originale) transaction.mockImplementation(originale);
    }
  });
});
