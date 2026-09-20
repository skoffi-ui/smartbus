import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GatewayService } from './gateway.service';
import { TenantGateService, TenantVerdict } from './tenant-gate.service';

// Les proxies sont remplacés : on vérifie uniquement la décision de la gateway
const proxyMocks: Record<string, jest.Mock> = {};
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn((opts: { target: string }) => {
    const fn = jest.fn();
    proxyMocks[opts.target] = fn;
    return fn;
  }),
}));

const SECRET = 'test-secret';
const SUPER = 'http://super';
const SCHOOL = 'http://school';

function makeRes() {
  const res: any = { headersSent: false };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('GatewayService', () => {
  let service: GatewayService;
  let jwt: JwtService;
  let verdict: TenantVerdict;
  let handler: ReturnType<GatewayService['handler']>;

  const token = (payload: object) => jwt.sign(payload);

  beforeEach(() => {
    Object.keys(proxyMocks).forEach((k) => delete proxyMocks[k]);
    verdict = 'ok';
    jwt = new JwtService({ secret: SECRET });

    const config = {
      get: (key: string, def?: string) =>
        ({ SUPER_APP_URL: SUPER, SCHOOL_APP_URL: SCHOOL, APP_MIN_VERSION: '2.0.0' } as Record<string, string>)[key] ?? def,
    } as unknown as ConfigService;
    const tenantGate = { check: jest.fn(async () => verdict) } as unknown as TenantGateService;

    service = new GatewayService(config, jwt, tenantGate);
    handler = service.handler();
  });

  async function call(method: string, url: string, headers: Record<string, string> = {}) {
    const req: any = { method, originalUrl: url, url, headers };
    const res = makeRes();
    const next = jest.fn();
    await handler(req, res, next);
    return { req, res, next };
  }

  it('injecte le tenant issu du JWT et écrase un x-tenant-id usurpé', async () => {
    const t = token({ sub: 'u1', role: 'school_admin', organisationId: 'org-A' });
    const { req, res } = await call('GET', '/api/v1/children', {
      authorization: `Bearer ${t}`,
      'x-tenant-id': 'org-VICTIME',
      'x-tenant-schema': 'org-VICTIME',
      'x-user-role': 'super_admin',
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(proxyMocks[SCHOOL]).toHaveBeenCalledTimes(1);
    expect(req.headers['x-tenant-id']).toBe('org-A');
    expect(req.headers['x-user-id']).toBe('u1');
    expect(req.headers['x-user-role']).toBe('school_admin');
    expect(req.headers['x-tenant-schema']).toBeUndefined();
  });

  it('retire les en-têtes d’identité même sur une route publique', async () => {
    const { req } = await call('POST', '/api/v1/auth/login', { 'x-tenant-id': 'org-VICTIME' });

    expect(proxyMocks[SUPER]).toHaveBeenCalledTimes(1);
    expect(req.headers['x-tenant-id']).toBeUndefined();
  });

  it('répond 401 sans token et ne proxifie pas', async () => {
    const { res } = await call('GET', '/api/v1/children');

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_MISSING' }));
    expect(proxyMocks[SCHOOL]).not.toHaveBeenCalled();
  });

  it('répond 401 pour un token signé avec un autre secret', async () => {
    const forged = new JwtService({ secret: 'autre' }).sign({ sub: 'u1', organisationId: 'org-A' });
    const { res } = await call('GET', '/api/v1/children', { authorization: `Bearer ${forged}` });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_INVALID' }));
  });

  it('répond 403 TENANT_SUSPENDED pour une école suspendue', async () => {
    verdict = 'suspended';
    const t = token({ sub: 'u1', organisationId: 'org-A' });
    const { res } = await call('GET', '/api/v1/children', { authorization: `Bearer ${t}` });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TENANT_SUSPENDED' }));
    expect(proxyMocks[SCHOOL]).not.toHaveBeenCalled();
  });

  it('laisse une école suspendue accéder à la SUPER APP (paiement / réactivation)', async () => {
    verdict = 'suspended';
    const t = token({ sub: 'u1', organisationId: 'org-A' });
    const { res } = await call('POST', '/api/v1/payments/initiate', { authorization: `Bearer ${t}` });

    expect(res.status).not.toHaveBeenCalled();
    expect(proxyMocks[SUPER]).toHaveBeenCalledTimes(1);
  });

  it("répond 403 si le compte n'a pas d'organisation sur une route école", async () => {
    const t = token({ sub: 'root', role: 'super_admin' });
    const { res } = await call('GET', '/api/v1/children', { authorization: `Bearer ${t}` });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_ORGANISATION' }));
  });

  it('répond 426 si x-app-version est inférieure au minimum', async () => {
    const t = token({ sub: 'u1', organisationId: 'org-A' });
    const { res } = await call('GET', '/api/v1/children', { authorization: `Bearer ${t}`, 'x-app-version': '1.9.9' });

    expect(res.status).toHaveBeenCalledWith(426);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'APP_UPDATE_REQUIRED' }));
    expect(proxyMocks[SCHOOL]).not.toHaveBeenCalled();
  });

  it('accepte une version égale ou supérieure, ou l’absence de l’en-tête', async () => {
    const t = token({ sub: 'u1', organisationId: 'org-A' });
    await call('GET', '/api/v1/children', { authorization: `Bearer ${t}`, 'x-app-version': '2.0.0' });
    await call('GET', '/api/v1/children', { authorization: `Bearer ${t}` });

    expect(proxyMocks[SCHOOL]).toHaveBeenCalledTimes(2);
  });

  it('répond 404 pour une route inconnue ou interne', async () => {
    const a = await call('GET', '/api/v1/inconnu');
    const b = await call('POST', '/api/v1/montees/validation');

    expect(a.res.status).toHaveBeenCalledWith(404);
    expect(b.res.status).toHaveBeenCalledWith(404);
  });
});
