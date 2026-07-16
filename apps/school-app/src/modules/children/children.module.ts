import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TenantModule, AuthModule, HttpModule],
  controllers: [ChildrenController],
  providers: [ChildrenService],
  exports: [ChildrenService],
})
export class ChildrenModule {}
