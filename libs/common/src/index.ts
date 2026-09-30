// Décorateurs
export * from './decorators/roles.decorator';
export * from './decorators/require-feature.decorator';
export * from './decorators/current-user.decorator';
export * from './decorators/public.decorator';
export * from './decorators/api-paginated-response.decorator';

// Guards
export * from './guards/jwt-auth.guard';
export * from './guards/roles.guard';
export * from './guards/features.guard';
export * from './guards/internal-api-key.guard';
export * from './guards/device-stream-api-key.guard';

// Constantes
export * from './constants/school-features';

// Interceptors
export * from './interceptors/logging.interceptor';
export * from './interceptors/transform.interceptor';

// Pipes
export * from './pipes/parse-uuid.pipe';

// Filters
export * from './filters/http-exception.filter';

// DTOs communs
export * from './dto/pagination.dto';
export * from './dto/pagination-response.dto';

// Chiffrement des secrets tiers
export * from './crypto/crypto.service';
export * from './crypto/crypto.module';
export * from './crypto/secret-crypto.util';

// Enums
export { UserRole } from './enums/user-role.enum';
export * from './config/jwt-secret';

// Utilitaires
export * from './utils/activation-token.util';

// PIN parent (bcrypt, même coût que les mots de passe utilisateurs)
export * from './security/parent-pin';

// Invitation directeur (sans base de données, voir director-invitation.service.ts)
export * from './invitations/director-invitation.service';
export * from './invitations/director-invitation.module';
