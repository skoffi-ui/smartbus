import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';

/**
 * Pipe ParseUUID – valide qu'un paramètre est bien un UUID v4.
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value || !uuidValidate(value) || uuidVersion(value) !== 4) {
      throw new BadRequestException(
        `${metadata.data} doit être un UUID v4 valide`,
      );
    }
    return value;
  }
}
