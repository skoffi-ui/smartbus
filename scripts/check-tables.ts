import { NestFactory } from '@nestjs/core';
import { SuperAppModule } from '../apps/super-app/src/super-app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SuperAppModule, { logger: ['error'] });
  const dataSource = app.get(DataSource);
  const tables = await dataSource.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log('Tables in database:', tables.map((t: any) => t.table_name));
  await app.close();
}

bootstrap().catch(console.error);
