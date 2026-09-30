import { NestFactory } from '@nestjs/core';
import { SuperAppModule } from '../apps/super-app/src/super-app.module';
import { BiotimeService } from '../apps/super-app/src/modules/biotime/biotime.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SuperAppModule);
  const biotimeService = app.get(BiotimeService);
  try {
    console.log('Testing sync-children...');
    const resultChildren = await biotimeService.syncChildren();
    console.log('Children Sync Result:', resultChildren);

    console.log('Testing sync-punches...');
    const resultPunches = await biotimeService.syncPunches();
    console.log('Punches Sync Result:', resultPunches);
  } catch (error) {
    console.error('Error during sync:', error);
  } finally {
    await app.close();
  }
}
bootstrap();
