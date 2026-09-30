import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** Valeurs acceptées pour le statut notifié. Tout autre texte est refusé par le DTO. */
export const STATUTS_NOTIFICATION_CINETPAY = ['success', 'failed'] as const;

export class CinetpayWebhookDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-4111-8111-111111111111',
    description:
      'Identifiant du paiement PENDING créé par POST /payments/initiate.',
  })
  @IsUUID()
  paymentId: string;

  @ApiProperty({
    enum: STATUTS_NOTIFICATION_CINETPAY,
    example: 'success',
    description: '`success` solde le paiement ; `failed` le marque en échec.',
  })
  @IsIn(STATUTS_NOTIFICATION_CINETPAY)
  status: (typeof STATUTS_NOTIFICATION_CINETPAY)[number];

  @ApiProperty({
    example: 'TX-9F3A',
    description:
      "Identifiant de transaction côté prestataire. Sert de clé d'idempotence.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  transactionId: string;

  @ApiProperty({
    example: 50000,
    description:
      'Montant notifié. Doit être égal au montant du paiement PENDING (2 décimales).',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiProperty({
    example: 'FCFA',
    description:
      'Devise notifiée. Doit correspondre à celle enregistrée sur le paiement PENDING.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  currency: string;
}
