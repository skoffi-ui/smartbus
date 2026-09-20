import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpException, HttpStatus, Req } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto, UpdateChildDto } from './dto/children.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { UserRole } from '@app/database';

@ApiTags('Children')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SCHOOL_ADMIN)
@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  /** Jeton de l'appelant, relayé à la super-app pour qu'elle identifie l'école. */
  private jeton(req: { headers: Record<string, string | undefined> }): string {
    return (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  }

  @Post()
  @ApiOperation({ summary: 'Créer un élève' })
  async create(@Body() createChildDto: CreateChildDto) {
    try {
      return await this.childrenService.create(createChildDto);
    } catch (e: any) {
      throw new HttpException({
        message: e.message,
        stack: e.stack
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les élèves' })
  findAll() {
    return this.childrenService.findAll();
  }

  @Get('biotime-directory')
  @ApiOperation({ summary: 'Récupérer le répertoire BioTime' })
  async getBiotimeDirectory(@Req() req: any) {
    return this.childrenService.getBiotimeDirectory(this.jeton(req));
  }

  @Post('resync-photos')
  @ApiOperation({ summary: 'Resynchroniser les photos BioTime des enfants en base' })
  async resyncPhotos(@Req() req: any) {
    return this.childrenService.resyncPhotos(this.jeton(req));
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Importer en masse depuis BioTime' })
  async bulkImport(@Body('empCodes') empCodes: string[], @Req() req: any) {
    return this.childrenService.bulkImport(empCodes, this.jeton(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un élève par ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.childrenService.findOne(id, this.jeton(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un élève' })
  update(@Param('id') id: string, @Body() updateChildDto: UpdateChildDto) {
    return this.childrenService.update(id, updateChildDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un élève' })
  remove(@Param('id') id: string) {
    return this.childrenService.remove(id);
  }

  @Get(':id/punches')
  @ApiOperation({ summary: 'Récupérer l\'historique des pointages d\'un élève' })
  async getPunches(@Param('id') id: string, @Req() req: any) {
    return this.childrenService.getPunches(id, this.jeton(req));
  }
}
