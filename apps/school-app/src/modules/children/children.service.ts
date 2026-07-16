import { Injectable, NotFoundException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Child } from '@app/database/tenant-entities/child.entity';
import { CreateChildDto, UpdateChildDto } from './dto/children.dto';
import { TenantService } from '../tenant/tenant.service';
import { Parent } from '@app/database/tenant-entities/parent.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChildrenService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly httpService: HttpService
  ) {}

  private async getRepo(): Promise<Repository<Child>> {
    const dataSource = await this.tenantService.getDataSource();
    return dataSource.getRepository(Child);
  }

  private async getParentRepo(): Promise<Repository<Parent>> {
    const dataSource = await this.tenantService.getDataSource();
    return dataSource.getRepository(Parent);
  }

  async findAll(): Promise<Child[]> {
    const repo = await this.getRepo();
    return repo.find({ relations: { parent: true }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Child> {
    const repo = await this.getRepo();
    const child = await repo.findOne({ where: { id }, relations: { parent: true } });
    if (!child) {
      throw new NotFoundException(`Élève ${id} introuvable.`);
    }

    // Auto-sync photo from super-app if we don't have it locally
    if (!child.photoUrl && child.empCode) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`http://localhost:3000/api/v1/biotime/employee/${child.empCode}`)
        );
        if (response.data && response.data.photo) {
          const photo = response.data.photo;
          if (photo.startsWith('http')) {
            child.photoUrl = photo;
          } else if (photo.startsWith('/')) {
            child.photoUrl = `http://160.120.143.20${photo}`;
          } else {
            child.photoUrl = `data:image/jpeg;base64,${photo}`;
          }
          await repo.save(child);
        }
      } catch (err) {
        // Silently ignore if super-app can't find the photo or is down
      }
    }

    return child;
  }

  async create(createChildDto: CreateChildDto): Promise<Child> {
    const repo = await this.getRepo();
    
    // Check if empCode is unique
    if (createChildDto.empCode) {
      const existing = await repo.findOne({ where: { empCode: createChildDto.empCode } });
      if (existing) {
        throw new ConflictException(`Le matricule BioTime ${createChildDto.empCode} est déjà assigné à un autre élève.`);
      }
    }

    // Set default date of birth if omitted (as it is required in the DB schema)
    if (!createChildDto.dateOfBirth) {
      createChildDto.dateOfBirth = '2015-01-01';
    }

    const child = repo.create(createChildDto);

    if (createChildDto.parentId) {
      const parentRepo = await this.getParentRepo();
      const parent = await parentRepo.findOne({ where: { id: createChildDto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent introuvable.`);
      }
      child.parent = parent;
    }

    return repo.save(child);
  }

  async update(id: string, updateChildDto: UpdateChildDto): Promise<Child> {
    const repo = await this.getRepo();
    const child = await this.findOne(id);
    
    if (updateChildDto.empCode && updateChildDto.empCode !== child.empCode) {
      const existing = await repo.findOne({ where: { empCode: updateChildDto.empCode } });
      if (existing) {
        throw new ConflictException(`Le matricule BioTime ${updateChildDto.empCode} est déjà assigné.`);
      }
    }

    if (updateChildDto.parentId && updateChildDto.parentId !== child.parentId) {
      const parentRepo = await this.getParentRepo();
      const parent = await parentRepo.findOne({ where: { id: updateChildDto.parentId } });
      if (!parent) {
        throw new NotFoundException(`Parent introuvable.`);
      }
      child.parent = parent;
    } else if (updateChildDto.parentId === null) {
      child.parent = null;
    }

    Object.assign(child, updateChildDto);
    // don't overwrite parent with string id if Object.assign did it
    if (updateChildDto.parentId) {
      delete (child as any).parentId; 
    }

    return repo.save(child);
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getRepo();
    const child = await this.findOne(id);
    await repo.remove(child);
  }

  async getPunches(id: string): Promise<any[]> {
    const child = await this.findOne(id);
    if (!child.empCode) {
      return [];
    }
    
    try {
      // Appel du super-app pour récupérer l'historique
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3000/api/v1/biotime/punches/empcode/${child.empCode}`)
      );
      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la récupération des pointages pour l'enfant ${id}`, error);
      return []; // Return empty array on failure instead of crashing
    }
  }

  async getBiotimeDirectory(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3000/api/v1/biotime/directory`)
      );
      return response.data || [];
    } catch (error) {
      console.error(`Erreur lors de la récupération du répertoire BioTime`, error);
      throw new HttpException('Erreur de communication avec le serveur central', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkImport(empCodes: string[]): Promise<any> {
    if (!empCodes || empCodes.length === 0) {
      return { message: 'Aucun matricule fourni', count: 0 };
    }

    try {
      // 1. Fetch details from super-app
      const response = await firstValueFrom(
        this.httpService.post(`http://localhost:3000/api/v1/biotime/directory/bulk`, { empCodes })
      );
      const employees = response.data || [];
      
      const repo = await this.getRepo();
      let importedCount = 0;

      for (const emp of employees) {
        // 2. Check if already exists in this school
        const existing = await repo.findOne({ where: { empCode: emp.empCode } });
        if (!existing) {
          // 3. Create child
          const child = repo.create({
            firstName: emp.firstName,
            lastName: emp.lastName,
            empCode: emp.empCode,
            className: emp.departmentName,
            dateOfBirth: '2015-01-01', // Default required
            isActive: true
          });

          // Process photo
          if (emp.photo) {
            const photo = emp.photo;
            if (photo.startsWith('http')) {
              child.photoUrl = photo;
            } else if (photo.startsWith('/')) {
              child.photoUrl = `http://160.120.143.20${photo}`;
            } else {
              child.photoUrl = `data:image/jpeg;base64,${photo}`;
            }
          }

          await repo.save(child);
          importedCount++;
        }
      }

      return { message: 'Importation réussie', count: importedCount };
    } catch (error) {
      console.error(`Erreur lors de l'importation en masse`, error);
      throw new HttpException('Erreur lors de l\'importation en masse', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
