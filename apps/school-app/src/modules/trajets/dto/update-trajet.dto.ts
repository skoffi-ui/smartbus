import { PartialType } from '@nestjs/swagger';
import { CreateTrajetDto } from './create-trajet.dto';
export class UpdateTrajetDto extends PartialType(CreateTrajetDto) {}
