import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TransportService } from './transport.service';
import { ValidationService } from './validation.service';

@Controller('transport')
// @UseGuards(JwtAuthGuard) // Commented out for dev, but usually required
export class TransportController {
  constructor(
    private readonly transportService: TransportService,
    private readonly validationService: ValidationService,
  ) {}

  // --- Courses ---
  @Get('courses')
  getCourses() {
    return this.transportService.findAllCourses();
  }

  @Get('courses/:id')
  getCourse(@Param('id') id: string) {
    return this.transportService.findCourseById(id);
  }

  @Post('courses')
  createCourse(@Body() data: any) {
    return this.transportService.createCourse(data);
  }

  @Put('courses/:id')
  updateCourse(@Param('id') id: string, @Body() data: any) {
    return this.transportService.updateCourse(id, data);
  }

  @Delete('courses/:id')
  deleteCourse(@Param('id') id: string) {
    return this.transportService.deleteCourse(id);
  }

  // --- Trajets ---
  @Post('trajets')
  createTrajet(@Body() data: any) {
    return this.transportService.createTrajet(data);
  }

  @Put('trajets/:id')
  updateTrajet(@Param('id') id: string, @Body() data: any) {
    return this.transportService.updateTrajet(id, data);
  }

  // --- Points ---
  @Get('courses/:id/points')
  getPointsByCourse(@Param('id') courseId: string) {
    return this.transportService.getPointsByCourseId(courseId);
  }

  @Post('courses/:id/points')
  createPointForCourse(@Param('id') courseId: string, @Body() data: any) {
    return this.transportService.createPointForCourse(courseId, data);
  }

  @Delete('points/:id')
  deletePoint(@Param('id') id: string) {
    return this.transportService.deletePoint(id);
  }

  @Post('points')
  createPoint(@Body() data: any) {
    return this.transportService.createPoint(data);
  }

  // --- Affectations ---
  @Post('points/:id/enfants')
  affecterEnfant(@Param('id') pointId: string, @Body() data: { childId: string, ordreMontee: number }) {
    return this.transportService.createAffectation({ ...data, pointId });
  }

  // --- Historique & Alertes ---
  @Get('montees')
  getMontees() {
    return this.transportService.getMontees();
  }

  @Get('alertes')
  getAlertes() {
    return this.transportService.getAlertes();
  }

  // --- Validation Biométrique ---
  @Post('validation')
  async validateMontee(@Body() data: { id_enfant: string, terminal: string, gps_lat?: number, gps_lng?: number, heure?: string }) {
    await this.validationService.processValidation(data);
    return { success: true, message: 'Validation traitée' };
  }
}
