import transactions from './__fixtures__/transactions.json';
import { generateK, recover, sign, signTransaction, verify } from './ecdsa';

// test test test test test test test test test test test ball
const PRIVATE_KEY = Buffer.from('044ce8e536ea4e4c61b42862bc98f8c574942fb77121e27f316cb15a96d9c99a', 'hex');
const PUBLIC_KEY = Buffer.from('03e6159bb12479339ce9be03fa724f53692893e7c91de9be2c00ca8d554fca8f51', 'hex');

// Hash for message "foo bar" (including prefix)
const HASH = Buffer.from('e4e90cf9bf8145f8def57bb3c0af1322624634ac887c350a687d58983f9ceb90', 'hex');

describe('generateK', () => {
  it('generates a deterministic value for k', () => {
    expect(generateK(HASH, PRIVATE_KEY).toString(16)).toBe(
      'dcac3c6d4c75c6721ef7ad5ca1f95fa1a6f3e23f6c79fbc21bd04ba4333b3c58'
    );
  });
});

describe('sign', () => {
  it('returns a signature for a message', () => {
    const { v, r, s } = sign('foo bar', PRIVATE_KEY);
    expect(v).toBe(28);
    expect(r.toString(16)).toBe('fc99faa16863cc14d1d549e86bcdbe83e98672ce0999317311223e8e000ab5d1');
    expect(s.toString(16)).toBe('4f2adaa7385445ee7ea492fdbcd9790fbdc638c2b21f17f732b69b811ca5fbe1');
  });
});

describe('signTransaction', () => {
  it('signs a transaction', () => {
    transactions.forEach(transaction => {
      const privateKey = Buffer.from(transaction.key, 'hex');
      const { raw, signed } = signTransaction(transaction, privateKey);
      expect(raw.toString('hex')).toBe(transaction.unsigned);
      expect(signed.toString('hex')).toBe(transaction.signed);
    });
  });
});

describe('verify', () => {
  it('verifies a signature', () => {
    const signature = sign('foo bar', PRIVATE_KEY);
    expect(verify('foo bar', signature, PUBLIC_KEY)).toBe(true);
  });

  it('verifies a non-deterministic signature', () => {
    const signature = sign('foo bar', PRIVATE_KEY, false);
    expect(verify('foo bar', signature, PUBLIC_KEY)).toBe(true);
  });
});

describe('recover', () => {
  it('recovers an address from a signature and message', () => {
    const signature = sign('foo bar', PRIVATE_KEY);
    expect(recover('foo bar', signature)).toBe('0x0068D351c60f6326fd8a9508A6Fb17cF64461728');
  });

  it('recovers a non-deterministic signature', () => {
    const signature = sign('foo bar', PRIVATE_KEY, false);
    expect(recover('foo bar', signature)).toBe('0x0068D351c60f6326fd8a9508A6Fb17cF64461728');
  });
});
