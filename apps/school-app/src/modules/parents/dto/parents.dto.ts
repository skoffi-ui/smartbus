import { IsString, IsNotEmpty, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateParentDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;

  /**
   * Code d'accès à l'app parent (4 chiffres). Optionnel : si omis,
   * `ParentsService.create` en génère un aléatoirement — sans ce champ nulle
   * part (ni ici, ni dans le formulaire de Parents.tsx), tout parent créé
   * depuis l'interface école avait `pin_code` NULL en base et ne pouvait
   * jamais se connecter à l'app (`ParentPortalService.login` compare
   * `parent.pinCode === pinCode`, toujours faux contre `NULL`).
   */
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Le code PIN doit être composé de 4 chiffres.' })
  pinCode?: string;
}

export class UpdateParentDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Le code PIN doit être composé de 4 chiffres.' })
  pinCode?: string;
}
