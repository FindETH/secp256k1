import { Curve, decodePoint } from './curve';
import { pointAdd, pointMultiply, toBuffer } from './point';
import { bigIntToBuffer, bufferToBigInt, keccak256, toChecksumAddress } from './utils';

/**
 * All parameters defined by the Secp256k1 curve.
 */
export const secp256k1: Curve = {
  g: {
    x: BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
    y: BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8')
  },
  a: 0n,
  b: 7n,
  n: BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'),
  p: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f')
};

/**
 * Derive the public key from a private key. Returns the public key in compressed form.
 *
 * @param {Buffer} privateKey
 * @return {Buffer}
 */
export const getPublicKey = (privateKey: Buffer): Buffer => {
  const point = pointMultiply(secp256k1, secp256k1.g, privateKey);

  // TODO
  /*if (point.infinite) {
    throw new Error('Point is infinite');
  }*/

  return toBuffer(secp256k1, point, true);
};

export const getAddress = (publicKey: Buffer): string => {
  const buffer = decompressPublicKey(publicKey).subarray(1);

  const hash = keccak256(buffer)
    .subarray(-20)
    .toString('hex');
  return toChecksumAddress(hash);
};

/**
 * Add a tweak to the private key. Will throw an error if the resulting key is invalid, e.g. when the tweak is larger
 * than n, or if Ki = 0.
 *
 * @param {Buffer} privateKey
 * @param {Buffer} tweakBuffer
 * @return {Buffer}
 */
export const privateAdd = (privateKey: Buffer, tweakBuffer: Buffer): Buffer => {
  const key = bufferToBigInt(privateKey);
  const tweak = bufferToBigInt(tweakBuffer);

  if (tweak >= secp256k1.n) {
    throw new Error('Resulting key is invalid: tweak is larger than n');
  }

  const newKey = (key + tweak) % secp256k1.n;
  if (newKey === 0n) {
    throw new Error('Resulting key is invalid: new key is 0');
  }

  return bigIntToBuffer(newKey, 32);
};

/**
 * Add a tweak to the public key. Will throw an error if the resulting key is invalid, e.g. when the tweak is larger
 * than n, or if Ki is the point at infinity.
 *
 * @param {Buffer} publicKey
 * @param {Buffer} tweakBuffer
 * @return {Buffer}
 */
export const publicAdd = (publicKey: Buffer, tweakBuffer: Buffer): Buffer => {
  const key = decodePoint(secp256k1, publicKey);
  const tweak = bufferToBigInt(tweakBuffer);

  if (tweak >= secp256k1.n) {
    throw new Error('Resulting key is invalid: tweak is larger than n');
  }

  const q = pointMultiply(secp256k1, secp256k1.g, tweak);
  const point = pointAdd(secp256k1, key, q);

  // TODO
  /*if (point.infinite) {
    throw new Error('Resulting key is invalid: point is at infinity');
  }*/

  return toBuffer(secp256k1, point, true);
};

/**
 * Get the compressed public key from a decompressed public key. Throws if the key is invalid.
 *
 * @param {Buffer} publicKey
 * @return {Buffer}
 */
export const compressPublicKey = (publicKey: Buffer): Buffer => {
  const key = decodePoint(secp256k1, publicKey);

  return toBuffer(secp256k1, key, true);
};

/**
 * Get the decompressed public key from a compressed public key. Throws if the public key is invalid.
 *
 * @param {Buffer} publicKey
 * @return {Buffer}
 */
export const decompressPublicKey = (publicKey: Buffer): Buffer => {
  const key = decodePoint(secp256k1, publicKey);

  return toBuffer(secp256k1, key, false);
};
