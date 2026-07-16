import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly httpService: HttpService) {}

  @OnEvent('punch.received')
  handlePunchReceivedEvent(payload: any) {
    const { child, punch } = payload;
    
    const childName = `${child.firstName || ''} ${child.lastName || ''}`.trim();
    const punchType = punch.punchState === '0' ? 'MONTÉE' : punch.punchState === '1' ? 'DESCENTE' : 'POINTAGE';
    const terminal = punch.terminalSn || 'Inconnu';
    const time = new Date(punch.punchTime).toLocaleTimeString('fr-FR');

    this.logger.log(`🚨 ALERTE : L'enfant ${childName} vient d'effectuer un pointage (${punchType}) à ${time} sur le terminal [${terminal}]`);
    
    // Transfert à school-app pour fusion GPS et stockage de Notification
    const payloadToSchool = {
      empCode: child.empCode,
      terminalSn: punch.terminalSn,
      punchState: punch.punchState,
      time: punch.punchTime,
    };

    try {
      firstValueFrom(this.httpService.post('http://localhost:3001/api/v1/notifications/internal-webhook', payloadToSchool))
        .then(() => this.logger.log(`✅ Webhook interne envoyé à school-app avec succès`))
        .catch(err => this.logger.error(`❌ Erreur lors de l'envoi du webhook interne: ${err.message}`));
    } catch (err) {
      this.logger.error(`Failed to send internal webhook: ${err.message}`);
    }
  }
}
