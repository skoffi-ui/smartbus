import { extraireIpClient } from './parent-auth.config';

describe('extraireIpClient', () => {
  it('prend le dernier saut, celui ajouté par la gateway', () => {
    expect(
      extraireIpClient({
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      }),
    ).toBe('5.6.7.8');
  });

  it("retombe sur l'adresse de la socket sans en-tête", () => {
    expect(extraireIpClient({ ip: '127.0.0.1', headers: {} })).toBe(
      '127.0.0.1',
    );
  });
});
