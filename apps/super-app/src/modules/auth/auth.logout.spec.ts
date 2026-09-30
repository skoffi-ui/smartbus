import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

/**
 * La déconnexion doit effacer le refresh token. Un identifiant vide ne doit
 * pas atteindre TypeORM : `update(undefined)` lève « Empty criteria » (500).
 */
describe('AuthService.logout', () => {
  const update = jest.fn();
  const service = new AuthService(
    { update } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue({ affected: 1 });
  });

  it("efface le refresh token de l'utilisateur", async () => {
    await service.logout(USER_ID);

    expect(update).toHaveBeenCalledWith(USER_ID, { refreshToken: null });
  });

  it("rejette un identifiant vide sans interroger le dépôt", async () => {
    await expect(service.logout('')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.logout(undefined as unknown as string)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(update).not.toHaveBeenCalled();
  });
});
