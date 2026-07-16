import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organisation } from '@app/database';
import { TenantService } from './tenant.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Organisation])],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
