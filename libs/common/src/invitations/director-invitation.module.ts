import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DirectorInvitationService } from './director-invitation.service';

/**
 * Global : disponible partout (AuthModule, UsersModule...) sans réimport.
 * `JwtModule.register({})` sans options : secret et expiration sont passés
 * explicitement à chaque appel dans DirectorInvitationService, comme le fait
 * déjà AuthService.generateTokens ailleurs dans le projet.
 */
@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [DirectorInvitationService],
  exports: [DirectorInvitationService],
})
export class DirectorInvitationModule {}
