import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '@app/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('transport')
@Controller('transport')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  // --- Courses ---
  @Get('courses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getCourses() {
    return this.transportService.findAllCourses();
  }

  @Get('courses/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getCourse(@Param('id') id: string) {
    return this.transportService.findCourseById(id);
  }

  @Post('courses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createCourse(@Body() data: CreateCourseDto) {
    return this.transportService.createCourse(data);
  }

  @Put('courses/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateCourse(@Param('id') id: string, @Body() data: UpdateCourseDto) {
    return this.transportService.updateCourse(id, data);
  }

  @Delete('courses/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deleteCourse(@Param('id') id: string) {
    return this.transportService.deleteCourse(id);
  }

  // --- Trajets ---
  @Post('trajets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createTrajet(@Body() data: any) {
    return this.transportService.createTrajet(data);
  }

  @Put('trajets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateTrajet(@Param('id') id: string, @Body() data: any) {
    return this.transportService.updateTrajet(id, data);
  }

  // --- Points ---
  @Get('courses/:id/points')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPointsByCourse(@Param('id') courseId: string) {
    return this.transportService.getPointsByCourseId(courseId);
  }

  @Post('courses/:id/points')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createPointForCourse(@Param('id') courseId: string, @Body() data: any) {
    return this.transportService.createPointForCourse(courseId, data);
  }

  @Delete('points/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deletePoint(@Param('id') id: string) {
    return this.transportService.deletePoint(id);
  }

  @Post('points')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createPoint(@Body() data: any) {
    return this.transportService.createPoint(data);
  }

  // --- Affectations ---
  @Post('points/:id/enfants')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  affecterEnfant(@Param('id') pointId: string, @Body() data: { childId: string, ordreMontee: number }) {
    return this.transportService.createAffectation({ ...data, pointId });
  }

  // --- Historique & Alertes ---
  @Get('montees')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMontees() {
    return this.transportService.getMontees();
  }

  @Get('alertes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getAlertes() {
    return this.transportService.getAlertes();
  }

  // --- Validation Biométrique (Public) ---
  @Post('validation')
  async validateMontee(@Body() data: { id_enfant: string, terminal: string, gps_lat?: number, gps_lng?: number, heure?: string }) {
    await this.transportService.processValidation(data);
    return { success: true, message: 'Validation traitée' };
  }
}
