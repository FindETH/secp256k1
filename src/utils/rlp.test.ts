import fixtures from './__fixtures__/rlp.json';
import { rlpEncode } from './rlp';

describe('rlpEncode', () => {
  it('encodes data with RLP', () => {
    Object.values(fixtures).forEach(({ in: input, out }) => {
      expect(rlpEncode(input).toString('hex')).toBe(out.slice(2));
    });
  });
});
