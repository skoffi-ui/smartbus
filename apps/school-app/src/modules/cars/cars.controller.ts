import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CarsService } from './cars.service';
import { CreateCarDto, UpdateCarDto } from './dto/cars.dto';
import { JwtAuthGuard, RolesGuard, Roles, FeaturesGuard, RequireFeature } from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('cars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, FeaturesGuard)
@Roles(UserRole.SCHOOL_ADMIN)
@RequireFeature('cars')
@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un nouveau véhicule (Bus) à la flotte' })
  create(@Body() createCarDto: CreateCarDto) {
    return this.carsService.create(createCarDto);
  }

  @Get('allocated-devices')
  @ApiOperation({ summary: 'Lister le matériel SaaS alloué à cette école' })
  getAllocatedDevices() {
    return this.carsService.getAllocatedDevices();
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les véhicules de l\'école' })
  // Aussi utilisé par Courses.tsx (choix du véhicule d'une course) et
  // LiveTracking.tsx (afficher les détails du bus sur la carte en direct).
  @RequireFeature('cars', 'courses', 'live')
  findAll() {
    return this.carsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir les détails d\'un véhicule' })
  findOne(@Param('id') id: string) {
    return this.carsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour les informations d\'un véhicule' })
  update(@Param('id') id: string, @Body() updateCarDto: UpdateCarDto) {
    return this.carsService.update(id, updateCarDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Retirer un véhicule de la flotte' })
  remove(@Param('id') id: string) {
    return this.carsService.remove(id);
  }
}
