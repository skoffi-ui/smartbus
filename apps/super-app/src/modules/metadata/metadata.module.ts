import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetaData } from '@app/database';
import { MetaDataController } from './metadata.controller';
import { MetaDataService } from './metadata.service';

@Module({
  imports: [TypeOrmModule.forFeature([MetaData])],
  controllers: [MetaDataController],
  providers: [MetaDataService],
  exports: [MetaDataService],
})
export class MetaDataModule {}
