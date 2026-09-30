import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import {
  BiotimeTerminal,
  Organisation,
  OrganisationStatus,
  Subscription,
  TENANT_ENTITIES,
} from '@app/database';
import { UserRole } from '@app/common';
import { SchoolAppModule } from '../../apps/school-app/src/school-app.module';
import { assurerVariablesE2e } from '../env-e2e';
import { configurerApplicationHttp } from './application-http';

const CODE_ECOLE = 'ECOLE-E2E';

function sourceCentrale(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.SUPER_DB_HOST,
    port: Number(process.env.SUPER_DB_PORT || 5432),
    username: process.env.SUPER_DB_USER,
    password: process.env.SUPER_DB_PASSWORD,
    database: process.env.SUPER_DB_NAME,
    // Les deux côtés de Organisation.biotimeTerminals / subscriptions, sinon
    // TypeORM refuse de construire les métadonnées.
    entities: [Organisation, BiotimeTerminal, Subscription],
    synchronize: false,
  });
}

function sourceTenant(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.SUPER_DB_HOST,
    port: Number(process.env.SUPER_DB_PORT || 5432),
    username: process.env.SUPER_DB_USER,
    password: process.env.SUPER_DB_PASSWORD,
    database: process.env.SCHOOL_TENANT_DB_NAME,
    entities: TENANT_ENTITIES,
    synchronize: false,
  });
}

/**
 * École de test branchée sur la base tenant préparée par le global setup.
 * school-app n'a pas de route de login : le jeton est signé comme le fait la super-app.
 */
async function assurerOrganisation(): Promise<string> {
  const ds = sourceCentrale();
  await ds.initialize();
  try {
    const repo = ds.getRepository(Organisation);
    const base = {
      name: 'École E2E',
      code: CODE_ECOLE,
      status: OrganisationStatus.ACTIVE,
      dbName: process.env.SCHOOL_TENANT_DB_NAME,
      dbHost: process.env.SUPER_DB_HOST,
      dbPort: Number(process.env.SUPER_DB_PORT || 5432),
      dbUser: process.env.SUPER_DB_USER,
      dbPassword: process.env.SUPER_DB_PASSWORD,
      dbProvisioned: true,
    };
    let org = await repo.findOne({ where: { code: CODE_ECOLE } });
    if (!org) {
      org = await repo.save(repo.create(base));
    } else {
      Object.assign(org, base);
      org = await repo.save(org);
    }
    return org.id;
  } finally {
    await ds.destroy();
  }
}

export function jetonDirecteur(organisationId: string): string {
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '1h' },
  });
  return jwt.sign({
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'admin@school-test.ci',
    role: UserRole.SCHOOL_ADMIN,
    organisationId,
    allowedFeatures: null,
  });
}

export async function viderTablesEcole(tables: string[]): Promise<void> {
  const ds = sourceTenant();
  await ds.initialize();
  try {
    const liste = tables.map((table) => `"${table}"`).join(', ');
    await ds.query(`TRUNCATE ${liste} RESTART IDENTITY CASCADE`);
  } finally {
    await ds.destroy();
  }
}

export async function executerSurTenant<T>(
  travail: (ds: DataSource) => Promise<T>,
): Promise<T> {
  const ds = sourceTenant();
  await ds.initialize();
  try {
    return await travail(ds);
  } finally {
    await ds.destroy();
  }
}

export async function demarrerAppEcole(): Promise<{
  app: INestApplication;
  token: string;
  organisationId: string;
  fermer: () => Promise<void>;
}> {
  assurerVariablesE2e();
  const organisationId = await assurerOrganisation();
  const moduleFixture = await Test.createTestingModule({
    imports: [SchoolAppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  configurerApplicationHttp(app);
  await app.init();
  return {
    app,
    token: jetonDirecteur(organisationId),
    organisationId,
    fermer: () => app.close(),
  };
}
