import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your_super_secret_jwt_key_change_in_production',
    });
  }

  async validate(payload: any) {
    // Le payload correspond au contenu déchiffré du JWT.
    // Il contient typiquement: sub (userId), email, role, et organisationId.
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      organisationId: payload.organisationId,
    };
  }
}
