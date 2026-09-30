import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard, FeaturesGuard, RequireFeature } from '@app/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseStatus } from '@app/database';

@ApiTags('Courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeaturesGuard)
@RequireFeature('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste toutes les courses planifiées' })
  // Aussi utilisé par AffectationEleves.tsx (choisir la course à affecter).
  @RequireFeature('courses', 'affectation')
  findAll() {
    return this.coursesService.findAll();
  }

  @Get('active')
  @ApiOperation({
    summary: 'Liste toutes les courses en cours (statut ACTIVE)',
  })
  findActive() {
    return this.coursesService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupère une course par son UUID' })
  // Aussi utilisé par AffectationEleves.tsx, via getPointsByCourse/createPointForCourse
  // (résolution du trajetId d'une course avant de lister/créer ses points).
  @RequireFeature('courses', 'affectation')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Planifie une nouvelle course' })
  @ApiResponse({ status: 201, description: 'Course créée avec succès' })
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Met à jour une course existante' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      "Change uniquement le statut d'une course (ACTIVE, TERMINEE, ANNULEE)",
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('statut') statut: CourseStatus,
  ) {
    return this.coursesService.updateStatus(id, statut);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime une course' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.delete(id);
  }
}
