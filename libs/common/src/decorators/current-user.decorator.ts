import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur @CurrentUser – injecte l'utilisateur authentifié depuis la requête.
 * @example @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
