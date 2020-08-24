export type Input = Buffer | string | number | bigint | Input[];

/**
 * Encode the input using RLP. The input can be an array, or individual item.
 *
 * @param {Input} input
 * @return {Buffer}
 */
export const rlpEncode = (input: Input): Buffer => {
  if (Array.isArray(input)) {
    const buffer = Buffer.concat(input.map(rlpEncode));
    return Buffer.concat([rlpEncodeLength(buffer.length, 192), buffer]);
  }

  const buffer = rlpParseInput(input);
  if (buffer.length === 1 && buffer[0] < 128) {
    return buffer;
  }

  return Buffer.concat([rlpEncodeLength(buffer.length, 128), buffer]);
};

/**
 * Get a number as hexadecimal string, padded with extra zero if necessary.
 *
 * @param {number | bigint} n
 * @return {string}
 */
export const numberToHex = (n: number | bigint): string => {
  const hex = n.toString(16);
  return hex.length % 2 ? `0${hex}` : hex;
};

/**
 * Encode the length as a Buffer.
 *
 * @param {number} length
 * @param {number} offset
 * @return {Buffer}
 */
export const rlpEncodeLength = (length: number, offset: number): Buffer => {
  if (length < 56) {
    return Buffer.from([length + offset]);
  }

  if (length >= 256 ** 8) {
    throw new Error('Input is too long');
  }

  const data = numberToHex(length);
  const dataLength = data.length / 2;
  const firstByte = numberToHex(offset + 55 + dataLength);

  return Buffer.from(firstByte + data, 'hex');
};

/**
 * Parse the input to a Buffer.
 *
 * @param {Input} input
 * @return {Buffer}
 */
export const rlpParseInput = (input: Input): Buffer => {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input === 'string') {
    if (input.startsWith('0x')) {
      return Buffer.from(input.slice(2), 'hex');
    }

    return Buffer.from(input, 'utf8');
  }

  if (typeof input === 'bigint' || typeof input === 'number') {
    return rlpNumberToBuffer(input);
  }

  throw new Error('Invalid input type');
};

/**
 * Parse a number to a Buffer.
 *
 * @param {number | bigint} n
 * @return {Buffer}
 */
export const rlpNumberToBuffer = (n: number | bigint): Buffer => {
  if (n === 0 || n === 0n) {
    return Buffer.from([]);
  }

  return Buffer.from(numberToHex(n), 'hex');
};
