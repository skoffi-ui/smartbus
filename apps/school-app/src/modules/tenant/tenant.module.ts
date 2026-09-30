import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule, Organisation } from '@app/database';
import { TenantService } from './tenant.service';

@Global()
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Organisation])],
  providers: [TenantService],
  exports: [TenantService, DatabaseModule],
})
export class TenantModule {}
