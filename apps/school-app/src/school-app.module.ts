import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { EventEmitterModule } from '@nestjs/event-emitter';+
import { BullModule } from '@nestjs/bullmq';

// Modules infrastructure
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { PingModule } from './modules/ping/ping.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

// Modules entités de base
import { CarsModule } from './modules/cars/cars.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ChildrenModule } from './modules/children/children.module';
import { GpsModule } from './modules/gps/gps.module';
import { AlertesCritiquesModule } from './modules/alertes-critiques/alertes-critiques.module';

// ─── Nouveaux modules DDD (Architecture Guidelines) ───────────────────────
import { CoursesModule } from './modules/courses/courses.module';
import { TrajetsModule } from './modules/trajets/trajets.module';
import { PointsRecuperationModule } from './modules/points-recuperation/points-recuperation.module';
import { AffectationsModule } from './modules/affectations/affectations.module';
import { MonteesModule } from './modules/montees/montees.module';

@Module({
  imports: [
    // Config globale
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    EventEmitterModule.forRoot(),

    // BullMQ global (connexion Redis partagée entre tous les modules)
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // Infrastructure
    TenantModule,
    AuthModule,
    PingModule,
    NotificationsModule,

    // Entités de base
    CarsModule,
    DriversModule,
    ParentsModule,
    ChildrenModule,
    GpsModule,
    AlertesCritiquesModule,

    // Domaines métiers Transport (DDD)
    CoursesModule,
    TrajetsModule,
    PointsRecuperationModule,
    AffectationsModule,
    MonteesModule,
  ],
  controllers: [],
  providers: [],
})
export class SchoolAppModule {}
