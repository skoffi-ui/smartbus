import {
  estHashBcrypt,
  hasherPinParent,
  verifierPinParent,
} from './parent-pin';

describe('PIN parent (bcrypt, coût 12)', () => {
  const pin = '4821';

  it('stocke un hash bcrypt de coût 12, pas le PIN en clair', async () => {
    const hash = await hasherPinParent(pin);

    expect(hash).not.toBe(pin);
    expect(hash.startsWith('$2b$12$')).toBe(true);
    expect(estHashBcrypt(hash)).toBe(true);
    expect(estHashBcrypt(pin)).toBe(false);
    expect(await verifierPinParent(pin, hash)).toBe(true);
    expect(await verifierPinParent('0001', hash)).toBe(false);
  });

  it('refuse un PIN encore stocké en clair', async () => {
    expect(await verifierPinParent(pin, pin)).toBe(false);
    expect(await verifierPinParent(pin, null)).toBe(false);
  });
});
