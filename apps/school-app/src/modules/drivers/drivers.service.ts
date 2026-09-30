import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Driver } from '@app/database';
import { CreateDriverDto, UpdateDriverDto } from './dto/drivers.dto';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class DriversService {
  constructor(private readonly tenantService: TenantService) {}

  private async getRepo(): Promise<Repository<Driver>> {
    const dataSource = await this.tenantService.getDataSource();
    return dataSource.getRepository(Driver);
  }

  async findAll(): Promise<Driver[]> {
    const repo = await this.getRepo();
    return repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Driver> {
    const repo = await this.getRepo();
    const driver = await repo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        `Chauffeur ${id} introuvable dans cette école.`,
      );
    }
    return driver;
  }

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    const repo = await this.getRepo();
    const existing = await repo.findOne({
      where: { licenseNumber: createDriverDto.licenseNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Le permis ${createDriverDto.licenseNumber} existe déjà.`,
      );
    }
    const driver = repo.create(createDriverDto);
    return repo.save(driver);
  }

  async update(id: string, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    const repo = await this.getRepo();
    const driver = await this.findOne(id);
    Object.assign(driver, updateDriverDto);
    return repo.save(driver);
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getRepo();
    const driver = await this.findOne(id);
    await repo.remove(driver);
  }
}
