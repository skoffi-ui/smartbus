import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Utilisation de require pour contourner les limitations de typages de firebase-admin en TypeScript
const admin = require('firebase-admin');

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        this.isInitialized = true;
        this.logger.log('Firebase Cloud Messaging initialisé avec succès.');
      } catch (err: any) {
        this.logger.error(`Échec d'initialisation Firebase Admin SDK : ${err.message}`);
      }
    } else {
      this.logger.warn(
        'Firebase Cloud Messaging non configuré. Les notifications push seront simulées dans les journaux.'
      );
    }
  }

  /**
   * Indique si Firebase Admin SDK est réellement initialisé (`FIREBASE_PROJECT_ID`/
   * `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` valides), ou si les push sont
   * seulement simulées/journalisées. Exposé au Super Admin (voir
   * `ParentPortalController.getStatutNotifications`) — cet état ne doit pas
   * rester enterré dans un log de démarrage : sans lui, "les parents ne
   * reçoivent jamais rien" paraît être un bug applicatif alors que c'est
   * juste une configuration manquante.
   */
  estConfigure(): boolean {
    return this.isInitialized;
  }

  /**
   * Envoie une notification push via FCM.
   * Retourne false si le token est invalide ou expiré (pour nettoyage en BDD).
   */
  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<boolean> {
    if (!token) return false;

    if (!this.isInitialized) {
      this.logger.log(
        `[SIMULATION PUSH] Envoyé à [${token}] | Titre: "${title}" | Message: "${body}" | Data: ${JSON.stringify(
          data || {},
        )}`
      );
      return true;
    }

    try {
      await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
      });
      this.logger.log(`[FCM Push] Notification envoyée avec succès à [${token}]`);
      return true;
    } catch (error: any) {
      this.logger.error(`[FCM Push] Échec d'envoi à [${token}] : ${error.message}`);
      
      // Gestion robuste si le token est invalide ou expiré
      const invalidCodes = [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
      ];
      if (invalidCodes.includes(error.code) || error.message.includes('registration-token')) {
        this.logger.warn(
          `[FCM Push] Le token push est invalide ou a expiré. Indication pour nettoyage en base de données.`
        );
        return false;
      }
      return true; // Pour les autres erreurs temporaires de connexion, on conserve le token
    }
  }
}
