import { Injectable, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Organisation, TenantConnectionService } from '@app/database';
import { ParentLoginDto } from './dto/parent-login.dto';
import { FcmService } from './fcm.service';
import { jwtSecretRequis } from '@app/common';

@Injectable()
export class ParentPortalService {
  private readonly logger = new Logger(ParentPortalService.name);

  constructor(
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly fcmService: FcmService,
  ) {}

  /**
   * Connexion d'un parent avec recherche globale (SaaS) ou par code d'école
   */
  async login(dto: ParentLoginDto) {
    const { emailOrPhone, pinCode, schoolCode } = dto;

    // 1. Charger les écoles candidates
    let organisations: Organisation[] = [];
    if (schoolCode) {
      const org = await this.organisationRepository.findOne({
        where: { code: schoolCode, dbProvisioned: true },
      });
      if (org) organisations.push(org);
    } else {
      organisations = await this.organisationRepository.find({
        where: { dbProvisioned: true },
      });
    }

    if (organisations.length === 0) {
      throw new UnauthorizedException("Aucune école correspondante ou base non initialisée.");
    }

    // 2. Parcourir les écoles pour trouver le parent correspondant aux identifiants
    for (const org of organisations) {
      try {
        const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);
        
        // Requête dans le schéma de l'école
        const parentQuery = `
          SELECT id, first_name as "firstName", last_name as "lastName", email, phone, pin_code as "pinCode",
                 notif_punch_enabled as "notifPunchEnabled", notif_proximity_enabled as "notifProximityEnabled"
          FROM parents
          WHERE (email = $1 OR phone = $1)
            AND active = true
            AND deleted_at IS NULL
          LIMIT 1
        `;
        const result = await tenantDS.query(parentQuery, [emailOrPhone]);

        if (result && result.length > 0) {
          const parent = result[0];
          
          // Vérification du code PIN
          if (parent.pinCode === pinCode) {
            // Génération du Token JWT
            const payload = {
              sub: parent.id,
              email: parent.email || parent.phone,
              role: 'PARENT',
              organisationId: org.id,
            };

            const token = await this.jwtService.signAsync(payload, {
              secret: jwtSecretRequis(this.configService),
              expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d') as any,
            });

            this.logger.log(`[Parent Auth] Connexion réussie pour le parent ${parent.firstName} ${parent.lastName} sur le tenant ${org.name}`);

            return {
              success: true,
              parent: {
                id: parent.id,
                firstName: parent.firstName,
                lastName: parent.lastName,
                email: parent.email,
                phone: parent.phone,
                notifPunchEnabled: parent.notifPunchEnabled,
                notifProximityEnabled: parent.notifProximityEnabled,
              },
              tenantId: org.id,
              schoolName: org.name,
              schoolCode: org.code,
              token,
            };
          }
        }
      } catch (err) {
        this.logger.warn(`Erreur lors de la tentative de recherche parent sur l'école ${org.name} : ${err.message}`);
      }
    }

    // Si aucun parent n'a été trouvé avec ces identifiants
    throw new UnauthorizedException("Identifiants ou code PIN incorrects.");
  }

  /**
   * Récupère les enfants associés au parent connecté depuis sa base de données isolée
   */
  async getChildren(parentId: string, organisationId: string) {
    // 1. Récupérer l'organisation correspondante
    const org = await this.organisationRepository.findOne({
      where: { id: organisationId },
    });
    if (!org) {
      throw new NotFoundException("Organisation parente introuvable.");
    }

    // 2. Se connecter au schéma du tenant
    const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);

    // 3. Exécuter la jointure SQL pour extraire les enfants, arrêts et lignes de bus
    const query = `
      SELECT 
        c.id as "childId",
        c.first_name as "firstName",
        c.last_name as "lastName",
        c.student_id as "studentId",
        c.class_name as "className",
        c.photo_url as "photoUrl",
        pr.id as "stopId",
        pr.nom as "stopName",
        pr.latitude as "stopLatitude",
        pr.longitude as "stopLongitude",
        co.id as "courseId",
        co.nom as "courseName",
        co.type as "courseType",
        co.heure_depart as "heureDepart",
        co.heure_arrivee as "heureArrivee",
        d.first_name as "driverFirstName",
        d.last_name as "driverLastName",
        d.phone as "driverPhone",
        ca.plate_number as "carPlateNumber",
        ca.brand as "carBrand",
        ca.model as "carModel",
        ca.photo_url as "carPhotoUrl"
      FROM children c
      LEFT JOIN affectations aff ON aff.child_id = c.id
      LEFT JOIN points_recuperation pr ON pr.id = aff.point_id
      LEFT JOIN courses co ON co.trajet_id = pr.trajet_id AND co.deleted_at IS NULL
      -- Course.driverId/carId (voir course.entity.ts) : nommés "Legacy" dans
      -- leur commentaire, mais ce sont les champs réellement peuplés/utilisés
      -- par l'app école — voir aussi CentreAlertes.tsx côté school-web, qui
      -- s'appuie sur le même champ driverId pour son panneau chauffeur.
      -- Colonnes stockées en varchar (pas uuid, faute de type explicite sur
      -- la colonne d'origine) : cast explicite nécessaire pour les comparer
      -- à drivers.id/cars.id (vrais uuid), sinon Postgres refuse la comparaison.
      LEFT JOIN drivers d ON d.id = co.driver_id::uuid AND d.deleted_at IS NULL
      LEFT JOIN cars ca ON ca.id = co.car_id::uuid AND ca.deleted_at IS NULL
      WHERE c.parent_id = $1
        AND c.deleted_at IS NULL
    `;
    const results = await tenantDS.query(query, [parentId]);

    // 4. Regrouper et structurer le JSON de retour
    const childrenMap = new Map<string, any>();
    for (const row of results) {
      if (!childrenMap.has(row.childId)) {
        childrenMap.set(row.childId, {
          id: row.childId,
          firstName: row.firstName,
          lastName: row.lastName,
          studentId: row.studentId,
          className: row.className,
          photoUrl: row.photoUrl,
          usualStop: row.stopId ? {
            id: row.stopId,
            name: row.stopName,
            latitude: parseFloat(row.stopLatitude),
            longitude: parseFloat(row.stopLongitude),
          } : null,
          busLines: [],
        });
      }
      if (row.courseId) {
        childrenMap.get(row.childId).busLines.push({
          id: row.courseId,
          name: row.courseName,
          type: row.courseType,
          heureDepart: row.heureDepart,
          heureArrivee: row.heureArrivee,
          // `null` si aucun chauffeur/véhicule assigné à cette course —
          // l'app parent n'affiche alors pas de bouton d'appel ni de carte
          // véhicule (pas d'info fantôme).
          driver: row.driverPhone
            ? { firstName: row.driverFirstName, lastName: row.driverLastName, phone: row.driverPhone }
            : null,
          vehicule: row.carPlateNumber
            ? {
                plateNumber: row.carPlateNumber,
                brand: row.carBrand,
                model: row.carModel,
                photoUrl: row.carPhotoUrl,
              }
            : null,
        });
      }
    }

    return Array.from(childrenMap.values());
  }

  /**
   * Le parent change lui-même son code PIN — jusqu'ici, seul un directeur
   * pouvait le régénérer depuis Parents.tsx (app école). Exige l'ancien
   * code, comme n'importe quel changement de mot de passe.
   */
  async changerMonPin(parentId: string, organisationId: string, ancienPin: string, nouveauPin: string) {
    if (!/^\d{4}$/.test(nouveauPin)) {
      throw new UnauthorizedException('Le nouveau code PIN doit être composé de 4 chiffres.');
    }

    const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
    if (!org) throw new NotFoundException('Organisation introuvable.');
    const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);

    const result = await tenantDS.query(
      `SELECT pin_code as "pinCode" FROM parents WHERE id = $1 AND deleted_at IS NULL`,
      [parentId],
    );
    if (!result || result.length === 0) throw new NotFoundException('Parent introuvable.');
    if (result[0].pinCode !== ancienPin) {
      throw new UnauthorizedException('Code PIN actuel incorrect.');
    }

    await tenantDS.query(
      `UPDATE parents SET pin_code = $1, updated_at = now() WHERE id = $2`,
      [nouveauPin, parentId],
    );
    return { success: true, message: 'Code PIN modifié avec succès.' };
  }

  /**
   * Préférences de notification du parent connecté — couper un type
   * l'exclut aussi de l'historique (voir `handlePunchNotification`/
   * `handleProximityNotification`), pas seulement du push.
   */
  async updateNotificationPrefs(
    parentId: string,
    organisationId: string,
    prefs: { notifPunchEnabled?: boolean; notifProximityEnabled?: boolean },
  ) {
    const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
    if (!org) throw new NotFoundException('Organisation introuvable.');
    const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);

    const colonnes: string[] = [];
    const valeurs: any[] = [];
    if (typeof prefs.notifPunchEnabled === 'boolean') {
      colonnes.push(`notif_punch_enabled = $${colonnes.length + 1}`);
      valeurs.push(prefs.notifPunchEnabled);
    }
    if (typeof prefs.notifProximityEnabled === 'boolean') {
      colonnes.push(`notif_proximity_enabled = $${colonnes.length + 1}`);
      valeurs.push(prefs.notifProximityEnabled);
    }
    if (colonnes.length === 0) {
      return { success: true, message: 'Aucune préférence à modifier.' };
    }

    valeurs.push(parentId);
    await tenantDS.query(
      `UPDATE parents SET ${colonnes.join(', ')}, updated_at = now() WHERE id = $${valeurs.length}`,
      valeurs,
    );
    return { success: true };
  }

  /**
   * Enregistre le token FCM d'un parent
   */
  async saveFcmToken(parentId: string, organisationId: string, token: string) {
    const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
    if (!org) throw new NotFoundException("Organisation introuvable.");
    const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);
    
    await tenantDS.query(`
      UPDATE parents
      SET fcm_token = $1, updated_at = now()
      WHERE id = $2 AND deleted_at IS NULL
    `, [token, parentId]);

    return { success: true, message: "Token FCM enregistré avec succès." };
  }

  /**
   * Supprime le token FCM s'il est expiré ou invalide
   */
  async removeFcmToken(parentId: string, organisationId: string) {
    try {
      const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
      if (!org) return;
      const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);
      await tenantDS.query(`
        UPDATE parents
        SET fcm_token = NULL, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
      `, [parentId]);
      this.logger.log(`[Fcm Token Cleanup] Token supprimé pour le parent ${parentId} car invalide/expiré.`);
    } catch (err: any) {
      this.logger.error(`Impossible de nettoyer le token FCM pour le parent ${parentId} : ${err.message}`);
    }
  }

  /**
   * Écoute l'événement local de pointage ZKTeco pour envoyer une notification push Firebase
   */
  @OnEvent('hardware.punch')
  async handlePunchNotification(payload: { tenantId: string; courseId: string; data: any }) {
    const { tenantId, data } = payload;
    
    try {
      const org = await this.organisationRepository.findOne({ where: { id: tenantId } });
      if (!org) return;
      
      const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);
      
      // Récupérer le parent, son token FCM et ses préférences de notification
      const parentResult = await tenantDS.query(`
        SELECT p.id, p.fcm_token as "fcmToken", p.first_name as "firstName", p.notif_punch_enabled as "notifPunchEnabled"
        FROM parents p
        INNER JOIN children c ON c.parent_id = p.id
        WHERE c.id = $1 AND p.active = true AND p.deleted_at IS NULL AND c.deleted_at IS NULL
      `, [data.childId]);

      if (parentResult && parentResult.length > 0 && parentResult[0].notifPunchEnabled) {
        const parent = parentResult[0];
        const statusText = data.punchState === '1' ? 'descendu du' : 'monté dans le';
        const title = 'Pointage Bus SMARTBUS 🚌';
        const body = `Bonjour, votre enfant ${data.childName} est ${statusText} bus (${data.terminalSn}) à ${new Date(data.time).toLocaleTimeString('fr-FR')}.`;

        // Persistée AVANT le push : sans ça, l'onglet Notifications de l'app
        // parent resterait vide entre deux ouvertures — seul le push système,
        // jamais rejouable, existerait (voir `getNotifications`).
        await this.enregistrerNotification(tenantDS, data.childId, title, body, 'PUNCH', {
          terminalSn: data.terminalSn,
          punchState: data.punchState,
          time: data.time,
        });

        if (parent.fcmToken) {
          const success = await this.fcmService.sendPushNotification(parent.fcmToken, title, body, {
            type: 'punch',
            childId: data.childId,
          });

          // Nettoyage automatique du token si invalide
          if (!success) {
            await this.removeFcmToken(parent.id, tenantId);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Erreur d'envoi de notification push (pointage) : ${err.message}`);
    }
  }

  /**
   * Écoute l'événement local de proximité GPS pour envoyer une notification push Firebase
   */
  @OnEvent('hardware.proximity_alert')
  async handleProximityNotification(payload: { tenantId: string; courseId: string; data: any }) {
    const { tenantId, data } = payload;

    try {
      const org = await this.organisationRepository.findOne({ where: { id: tenantId } });
      if (!org) return;

      const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);

      // Récupérer le parent, son token FCM et ses préférences de notification
      const parentResult = await tenantDS.query(`
        SELECT p.id, p.fcm_token as "fcmToken", p.notif_proximity_enabled as "notifProximityEnabled"
        FROM parents p
        INNER JOIN children c ON c.parent_id = p.id
        WHERE c.id = $1 AND p.active = true AND p.deleted_at IS NULL AND c.deleted_at IS NULL
      `, [data.childId]);

      if (parentResult && parentResult.length > 0 && parentResult[0].notifProximityEnabled) {
        const parent = parentResult[0];
        const title = 'Approche du bus SMARTBUS 🚌';
        const body = `Le bus approche ! Il est actuellement à ${data.distance} km de l'arrêt de ${data.childName} (${data.stopName}).`;

        await this.enregistrerNotification(tenantDS, data.childId, title, body, 'PROXIMITY', {
          distance: data.distance,
          stopName: data.stopName,
          time: data.time,
        });

        if (parent.fcmToken) {
          const success = await this.fcmService.sendPushNotification(parent.fcmToken, title, body, {
            type: 'proximity_alert',
            childId: data.childId,
          });

          // Nettoyage automatique du token si invalide
          if (!success) {
            await this.removeFcmToken(parent.id, tenantId);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Erreur d'envoi de notification push (proximité) : ${err.message}`);
    }
  }

  /**
   * Enregistre une notification pour l'app parent (voir `getNotifications`).
   * Toujours appelée en plus de l'envoi push, jamais à sa place : le push
   * est éphémère (rien à revoir si l'app n'était pas ouverte au bon moment),
   * cette ligne est l'historique consultable dans l'onglet Notifications.
   */
  private async enregistrerNotification(
    tenantDS: any,
    childId: string,
    title: string,
    message: string,
    type: 'PUNCH' | 'PROXIMITY',
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      await tenantDS.query(
        `INSERT INTO notifications (title, message, type, metadata, child_id) VALUES ($1, $2, $3, $4, $5)`,
        [title, message, type, JSON.stringify(metadata), childId],
      );
    } catch (err: any) {
      this.logger.error(`Enregistrement de la notification parent impossible : ${err.message}`);
    }
  }

  /**
   * Historique des notifications des enfants du parent connecté, les plus
   * récentes d'abord. Consommé par l'onglet Notifications de l'app parent.
   */
  async getNotifications(parentId: string, organisationId: string, limit = 50, type?: string) {
    const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
    if (!org) throw new NotFoundException('Organisation introuvable.');
    const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);

    // `type` optionnel : filtre l'onglet « Présence » (PUNCH uniquement) de
    // l'onglet « Notifications » complet côté app — même endpoint, un seul
    // paramètre en plus, rétrocompatible (absent = tout, comme avant).
    const filtreType = type ? `AND n.type = $3` : '';
    return tenantDS.query(
      `
        SELECT n.id, n.title, n.message, n.type, n."isRead" as "isRead",
               n.metadata, n.child_id as "childId", n.created_at as "createdAt"
        FROM notifications n
        INNER JOIN children c ON c.id = n.child_id
        WHERE c.parent_id = $1 AND c.deleted_at IS NULL
        ${filtreType}
        ORDER BY n.created_at DESC
        LIMIT $2
      `,
      type ? [parentId, limit, type] : [parentId, limit],
    );
  }

  /**
   * Marque une notification comme lue — seulement si elle appartient bien à
   * un enfant du parent connecté (la jointure fait aussi office de contrôle
   * d'accès : impossible de marquer comme lue la notification d'un autre parent).
   */
  async markNotificationRead(notificationId: string, parentId: string, organisationId: string) {
    const org = await this.organisationRepository.findOne({ where: { id: organisationId } });
    if (!org) throw new NotFoundException('Organisation introuvable.');
    const tenantDS = await this.tenantConnectionService.getTenantConnection(org.id);

    const result = await tenantDS.query(
      `
        UPDATE notifications n
        SET "isRead" = true
        FROM children c
        WHERE n.child_id = c.id AND c.parent_id = $1 AND n.id = $2
        RETURNING n.id
      `,
      [parentId, notificationId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Notification introuvable pour ce parent.');
    }
    return { success: true };
  }
}
