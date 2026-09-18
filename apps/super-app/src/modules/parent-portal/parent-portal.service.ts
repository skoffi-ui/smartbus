import { Injectable, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Organisation, TenantConnectionService } from '@app/database';
import { ParentLoginDto } from './dto/parent-login.dto';
import { FcmService } from './fcm.service';

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
          SELECT id, first_name as "firstName", last_name as "lastName", email, phone, pin_code as "pinCode"
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
              secret: this.configService.get<string>('JWT_SECRET', 'secret'),
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
        co.heure_arrivee as "heureArrivee"
      FROM children c
      LEFT JOIN affectations aff ON aff.child_id = c.id
      LEFT JOIN points_recuperation pr ON pr.id = aff.point_id
      LEFT JOIN courses co ON co.trajet_id = pr.trajet_id AND co.deleted_at IS NULL
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
        });
      }
    }

    return Array.from(childrenMap.values());
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
      
      // Récupérer le parent et son token FCM
      const parentResult = await tenantDS.query(`
        SELECT p.id, p.fcm_token as "fcmToken", p.first_name as "firstName"
        FROM parents p
        INNER JOIN children c ON c.parent_id = p.id
        WHERE c.id = $1 AND p.active = true AND p.deleted_at IS NULL AND c.deleted_at IS NULL
      `, [data.childId]);

      if (parentResult && parentResult.length > 0 && parentResult[0].fcmToken) {
        const parent = parentResult[0];
        const statusText = data.punchState === '1' ? 'descendu du' : 'monté dans le';
        const title = 'Pointage Bus SMARTBUS 🚌';
        const body = `Bonjour, votre enfant ${data.childName} est ${statusText} bus (${data.terminalSn}) à ${new Date(data.time).toLocaleTimeString('fr-FR')}.`;

        const success = await this.fcmService.sendPushNotification(parent.fcmToken, title, body, {
          type: 'punch',
          childId: data.childId,
        });

        // Nettoyage automatique du token si invalide
        if (!success) {
          await this.removeFcmToken(parent.id, tenantId);
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

      // Récupérer le parent et son token FCM
      const parentResult = await tenantDS.query(`
        SELECT p.id, p.fcm_token as "fcmToken"
        FROM parents p
        INNER JOIN children c ON c.parent_id = p.id
        WHERE c.id = $1 AND p.active = true AND p.deleted_at IS NULL AND c.deleted_at IS NULL
      `, [data.childId]);

      if (parentResult && parentResult.length > 0 && parentResult[0].fcmToken) {
        const parent = parentResult[0];
        const title = 'Approche du bus SMARTBUS 🚌';
        const body = `Le bus approche ! Il est actuellement à ${data.distance} km de l'arrêt de ${data.childName} (${data.stopName}).`;

        const success = await this.fcmService.sendPushNotification(parent.fcmToken, title, body, {
          type: 'proximity_alert',
          childId: data.childId,
        });

        // Nettoyage automatique du token si invalide
        if (!success) {
          await this.removeFcmToken(parent.id, tenantId);
        }
      }
    } catch (err: any) {
      this.logger.error(`Erreur d'envoi de notification push (proximité) : ${err.message}`);
    }
  }
}
