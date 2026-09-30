import { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { HardwareStreamGateway } from './hardware-stream.gateway';

/**
 * Cloisonnement du flux temps réel.
 *
 * L'école d'un client vient du JWT vérifié à la connexion, jamais d'un paramètre
 * que le client envoie ensuite.
 */
describe('HardwareStreamGateway — cloisonnement des salons', () => {
  const SECRET = 'test-secret';
  const ORG_A = 'org-aaaa-1111';
  const ORG_B = 'org-bbbb-2222';

  let gateway: HardwareStreamGateway;
  let jwt: JwtService;
  let moduleRef: ModuleRef;

  const makeClient = (token?: string) => ({
    id: 'socket-1',
    handshake: { auth: token ? { token } : {}, headers: {} },
    data: {} as Record<string, unknown>,
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  });

  beforeEach(() => {
    jwt = new JwtService({ secret: SECRET });
    // ModuleRef simulé : exigé par le constructeur pour résoudre la connexion tenant hors HTTP.
    moduleRef = {
      registerRequestByContextId: jest.fn(),
      resolve: jest.fn(),
    } as unknown as ModuleRef;
    gateway = new HardwareStreamGateway(jwt, moduleRef);
  });

  describe('handleConnection', () => {
    it("rattache le client au salon de l'école portée par son jeton", async () => {
      const token = jwt.sign({ sub: 'u1', organisationId: ORG_A });
      const client = makeClient(token);

      await gateway.handleConnection(client as any);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.organisationId).toBe(ORG_A);
      expect(client.join).toHaveBeenCalledWith(`school:${ORG_A}`);
    });

    it('ferme la connexion sans jeton', async () => {
      const client = makeClient();

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it("ferme la connexion d'un jeton signé avec un autre secret", async () => {
      const forged = new JwtService({ secret: 'autre' }).sign({
        sub: 'u1',
        organisationId: ORG_B,
      });
      const client = makeClient(forged);

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it("ferme la connexion d'un compte sans école", async () => {
      const token = jwt.sign({ sub: 'root' });
      const client = makeClient(token);

      await gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleSubscribe', () => {
    it("ignore un tenantId usurpé et n'utilise que l'école du jeton", async () => {
      const token = jwt.sign({ sub: 'u1', organisationId: ORG_A });
      const client = makeClient(token);
      await gateway.handleConnection(client as any);
      client.join.mockClear();

      // Le client tente de se faire passer pour l'école B.
      gateway.handleSubscribe(
        { tenantId: ORG_B, courseId: 'course-9' } as any,
        client as any,
      );

      expect(client.join).toHaveBeenCalledWith(
        `school:${ORG_A}:course:course-9`,
      );
      expect(client.join).not.toHaveBeenCalledWith(
        expect.stringContaining(ORG_B),
      );
    });

    it('ferme la connexion si la session ne porte aucune école', () => {
      const client = makeClient();

      gateway.handleSubscribe({ courseId: 'course-9' }, client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('diffusion', () => {
    it("n'émet que vers les salons de l'école concernée", () => {
      const emit = jest.fn();
      const to = jest
        .fn()
        .mockReturnValue({ to: jest.fn().mockReturnValue({ emit }), emit });
      gateway.server = { to } as any;

      gateway.handleGpsBroadcast({
        tenantId: ORG_A,
        courseId: 'course-9',
        data: { lat: 5.35, lng: -4.0 },
      });

      expect(to).toHaveBeenCalledWith(`school:${ORG_A}:course:course-9`);
      const rooms = to.mock.calls.flat().join(' ');
      expect(rooms).not.toContain(ORG_B);
    });

    it('annule la diffusion si le tenantId est absent', () => {
      const to = jest.fn();
      gateway.server = { to } as any;

      gateway.handleGpsBroadcast({
        tenantId: '',
        courseId: 'course-9',
        data: {},
      });

      expect(to).not.toHaveBeenCalled();
    });
  });
});
