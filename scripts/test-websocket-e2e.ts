import { NestFactory } from '@nestjs/core';
import { SuperAppModule } from '../apps/super-app/src/super-app.module';
import { TenantConnectionService } from '../libs/database/src/tenant-connection.service';
import { Organisation, Child, Parent } from '@app/database';
import { io } from 'socket.io-client';
import axios from 'axios';

async function runE2ETest() {
  console.log('=== DÉBUT DU TEST D\'INTÉGRATION WEBSOCKET E2E ===');

  // 1. Initialiser le contexte NestJS pour accéder aux injectables et à la BDD
  const appContext = await NestFactory.createApplicationContext(SuperAppModule);
  const tenantService = appContext.get(TenantConnectionService);
  const centralDS = appContext.get('DataSource'); // Connexion globale

  const orgRepo = centralDS.getRepository(Organisation);

  // 2. Créer ou récupérer une école test pour l'isolation
  let testSchool = await orgRepo.findOne({ where: { code: 'SCH_E2E' } });
  if (!testSchool) {
    testSchool = orgRepo.create({
      name: 'École Test E2E',
      code: 'SCH_E2E',
      dbName: 'smartbus_school_test_e2e',
      dbProvisioned: true,
    });
    await orgRepo.save(testSchool);
  }

  // Se connecter au schéma spécifique de l'école
  const tenantDS = await tenantService.getTenantConnection(testSchool.id);
  const childRepo = tenantDS.getRepository(Child);
  const parentRepo = tenantDS.getRepository(Parent);

  // Nettoyer les anciennes données E2E si existantes
  await childRepo.delete({ empCode: 'EMP_E2E_01' });
  await parentRepo.delete({ email: 'parent.e2e@example.com' });

  // 3. Insérer un Parent et un Enfant de test dans la BDD isolée
  const testParent = parentRepo.create({
    firstName: 'Jean',
    lastName: 'E2E',
    email: 'parent.e2e@example.com',
    phone: '+22501020304',
    active: true,
  });
  await parentRepo.save(testParent);

  const testChild = childRepo.create({
    firstName: 'Petit',
    lastName: 'E2E',
    empCode: 'EMP_E2E_01',
    studentId: 'STUD_E2E',
    className: 'CM2-A',
    parent: testParent,
  });
  await childRepo.save(testChild);

  console.log(`✅ Données de test insérées : Élève id=[${testChild.id}] empCode=[${testChild.empCode}]`);

  // 4. Se connecter au Namespace WebSocket
  const socketUrl = 'http://localhost:3001/notifications';
  console.log(`🔌 Connexion au WebSocket: ${socketUrl}`);
  const socket = io(socketUrl, {
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Client WebSocket connecté avec succès.');
      resolve();
    });
    socket.on('connect_error', (err) => {
      reject(new Error(`Échec de connexion WebSocket : ${err.message}`));
    });
  });

  // 5. Rejoindre la salle de l'enfant
  console.log(`Join room: child_${testChild.id}`);
  socket.emit('subscribe_child', { childId: testChild.id });

  // 6. Configurer l'écouteur de notifications
  const eventReceivedPromise = new Promise<any>((resolve) => {
    socket.on('punch_event', (data) => {
      console.log('🎉 Événement WebSocket reçu en direct !');
      console.log(data);
      resolve(data);
    });
  });

  // 7. Déclencher le pointage via l'API Webhook
  const webhookUrl = 'http://localhost:3001/api/v1/notifications/internal-webhook';
  console.log(`🚀 Envoi du pointage HTTP vers ${webhookUrl}`);
  
  try {
    const webhookRes = await axios.post(
      webhookUrl,
      {
        empCode: 'EMP_E2E_01',
        terminalSn: 'ZKT_E2E_TEST',
        time: new Date().toISOString(),
        punchState: '0', // Montée
      },
      {
        headers: {
          'x-tenant-id': testSchool.id,
        },
      }
    );
    console.log('✅ Statut Webhook HTTP :', webhookRes.status, webhookRes.data);
  } catch (apiErr: any) {
    console.error('❌ Erreur API Webhook :', apiErr.response?.data || apiErr.message);
  }

  // 8. Attendre la réception de la notification WebSocket
  try {
    const wsData = await Promise.race([
      eventReceivedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout : Aucun événement reçu par le WebSocket après 5 secondes')), 5000)),
    ]);

    console.log('🏆 TEST RÉUSSI AVEC SUCCÈS !');
  } catch (testErr: any) {
    console.error(`❌ ÉCHEC DU TEST : ${testErr.message}`);
  } finally {
    // 9. Nettoyer les sockets et fermer NestJS
    socket.disconnect();
    await childRepo.delete({ empCode: 'EMP_E2E_01' });
    await parentRepo.delete({ email: 'parent.e2e@example.com' });
    await appContext.close();
    console.log('=== FIN DU TEST ===');
  }
}

runE2ETest().catch(console.error);
