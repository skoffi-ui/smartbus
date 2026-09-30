import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { JETON_SECRET_WEBHOOK_PAIEMENT } from './payment-webhook.constants';
import { secretWebhookPaiementRequis } from './payment-webhook-secret';
import { PaymentsModule } from './payments.module';

/** ConfigService minimal renvoyant la valeur fournie pour CINETPAY_WEBHOOK_SECRET. */
function config(valeur?: string): ConfigService {
  return {
    get: (cle: string) =>
      cle === 'CINETPAY_WEBHOOK_SECRET' ? valeur : undefined,
  } as ConfigService;
}

const SECRET_VALIDE = 'a'.repeat(64);

describe('secretWebhookPaiementRequis', () => {
  it('rend le secret configuré', () => {
    expect(secretWebhookPaiementRequis(config(SECRET_VALIDE))).toBe(
      SECRET_VALIDE,
    );
  });

  it("retire les espaces collés par l'environnement", () => {
    expect(secretWebhookPaiementRequis(config(`  ${SECRET_VALIDE}\n`))).toBe(
      SECRET_VALIDE,
    );
  });

  it('refuse de démarrer si CINETPAY_WEBHOOK_SECRET est absent', () => {
    expect(() => secretWebhookPaiementRequis(config(undefined))).toThrow(
      /CINETPAY_WEBHOOK_SECRET est requis/,
    );
    expect(() => secretWebhookPaiementRequis(config(''))).toThrow(
      /CINETPAY_WEBHOOK_SECRET est requis/,
    );
    expect(() => secretWebhookPaiementRequis(config('   '))).toThrow(
      /CINETPAY_WEBHOOK_SECRET est requis/,
    );
  });

  it('refuse un secret trop court', () => {
    expect(() => secretWebhookPaiementRequis(config('a'.repeat(31)))).toThrow(
      /trop court/,
    );
    expect(secretWebhookPaiementRequis(config('a'.repeat(32)))).toHaveLength(
      32,
    );
  });

  it('est la fabrique du module, donc exécutée au démarrage de la super-app', () => {
    const providers: unknown = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      PaymentsModule,
    );
    expect(Array.isArray(providers)).toBe(true);
    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: JETON_SECRET_WEBHOOK_PAIEMENT,
          useFactory: secretWebhookPaiementRequis,
        }),
      ]),
    );
  });
});
