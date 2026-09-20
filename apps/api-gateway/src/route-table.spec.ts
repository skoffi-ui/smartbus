import { resolveRoute } from './route-table';

describe('resolveRoute', () => {
  it('route les ressources école vers school-app, protégées', () => {
    expect(resolveRoute('GET', '/api/v1/children')).toEqual({ target: 'school', isPublic: false });
    expect(resolveRoute('POST', '/api/v1/courses/123/status')).toEqual({ target: 'school', isPublic: false });
  });

  it('route les ressources centrales vers super-app', () => {
    expect(resolveRoute('GET', '/api/v1/subscriptions/organisation/1')).toEqual({ target: 'super', isPublic: false });
    expect(resolveRoute('POST', '/api/v1/payments/initiate')).toEqual({ target: 'super', isPublic: false });
  });

  it('autorise sans JWT uniquement les routes publiques déclarées', () => {
    expect(resolveRoute('POST', '/api/v1/auth/login')).toEqual({ target: 'super', isPublic: true });
    expect(resolveRoute('POST', '/api/v1/auth/register-school')).toEqual({ target: 'super', isPublic: true });
    expect(resolveRoute('POST', '/api/v1/auth/parent/login')).toEqual({ target: 'super', isPublic: true });
    expect(resolveRoute('POST', '/api/v1/payments/webhook')).toEqual({ target: 'super', isPublic: true });
  });

  it('exige un JWT sur les autres routes auth (ex: /auth/me, /auth/logout)', () => {
    expect(resolveRoute('GET', '/api/v1/auth/me')).toEqual({ target: 'super', isPublic: false });
    expect(resolveRoute('POST', '/api/v1/auth/logout')).toEqual({ target: 'super', isPublic: false });
  });

  it("ne rend pas publique une route login appelée avec une autre méthode", () => {
    expect(resolveRoute('GET', '/api/v1/auth/login')?.isPublic).toBe(false);
  });

  it('ignore la query string et le slash final', () => {
    expect(resolveRoute('POST', '/api/v1/auth/login/?x=1')?.isPublic).toBe(true);
  });

  it('bloque les endpoints internes de service à service', () => {
    expect(resolveRoute('POST', '/api/v1/notifications/internal-webhook')).toBeNull();
    expect(resolveRoute('POST', '/api/v1/montees/validation')).toBeNull();
  });

  it('refuse les routes inconnues ou sans préfixe /api/vN', () => {
    expect(resolveRoute('GET', '/api/v1/inconnu')).toBeNull();
    expect(resolveRoute('GET', '/children')).toBeNull();
    expect(resolveRoute('GET', '/api/docs')).toBeNull();
  });
});
