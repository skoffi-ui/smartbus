import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Décorateur @Public – marque un endpoint comme public (pas d'authentification requise).
 * @example @Public() @Get('health')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
