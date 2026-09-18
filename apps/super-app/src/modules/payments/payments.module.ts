import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, Subscription, Organisation } from '@app/database';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CinetpayService } from './cinetpay.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Subscription, Organisation])],
  controllers: [PaymentsController],
  providers: [PaymentsService, CinetpayService],
})
export class PaymentsModule {}
