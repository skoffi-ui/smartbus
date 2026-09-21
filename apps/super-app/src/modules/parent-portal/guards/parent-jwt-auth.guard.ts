import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { jwtSecretRequis } from '@app/common';

@Injectable()
export class ParentJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant ou invalide.');
    }

    const token = authHeader.split(' ')[1];
    try {
      const secret = jwtSecretRequis(this.configService);
      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      // Validation du rôle de parent d'élève
      if (payload.role !== 'PARENT') {
        throw new UnauthorizedException("Accès refusé. Cette section est réservée aux parents d'élèves.");
      }

      // Injection de l'identité parent et du tenant ID dans la requête
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        organisationId: payload.organisationId,
      };
      return true;
    } catch (err) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }
  }
}
