import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, Subscription, Organisation } from '@app/database';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CinetpayService } from './cinetpay.service';
import { PlanTarifsModule } from '../plan-tarifs/plan-tarifs.module';
import { JETON_SECRET_WEBHOOK_PAIEMENT } from './payment-webhook.constants';
import { PaymentWebhookGuard } from './payment-webhook.guard';
import { secretWebhookPaiementRequis } from './payment-webhook-secret';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Subscription, Organisation]),
    PlanTarifsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    // Validé à l'instanciation du module, donc au démarrage de la super-app :
    // un secret absent ou trop court empêche le processus d'écouter.
    {
      provide: JETON_SECRET_WEBHOOK_PAIEMENT,
      inject: [ConfigService],
      useFactory: secretWebhookPaiementRequis,
    },
    PaymentWebhookGuard,
    PaymentsService,
    CinetpayService,
  ],
})
export class PaymentsModule {}
