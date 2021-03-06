import { Buffer } from 'buffer';
import { createHmac } from 'crypto';
import { Curve, decodePoint, getPointFromX } from './curve';
import { add, mod, modInverse, random } from './mod';
import { pointAdd, pointMultiply, toBuffer } from './point';
import { getAddress, secp256k1 } from './secp256k1';
import { bufferToBigInt, keccak256, numberToBuffer, rlpEncode } from './utils';

/**
 * An extended ECDSA signature {r, s, v}.
 */
export interface ECDSASignature {
  v: number;
  r: bigint;
  s: bigint;
}

export interface Transaction {
  nonce: number;
  gasPrice: number | bigint;
  gasLimit: number | bigint;
  to: string;
  value: number | bigint;
  data: Buffer | string;
  chainId?: number;
}

/**
 * Check if a private key is within the range 0 < x < n.
 *
 * @param {bigint} privateKey
 * @param {Curve} curve
 * @return {boolean}
 */
const isValidPrivateKey = (privateKey: bigint, curve: Curve): boolean => {
  return privateKey > 0 && privateKey < curve.n;
};

/**
 * Generate a deterministic value for `k`, according to RFC6979.
 *
 * @param {Buffer} hash
 * @param {Buffer} privateKey
 * @param {Curve} [curve]
 */
export const generateK = (hash: Buffer, privateKey: Buffer, curve: Curve = secp256k1): bigint => {
  let k = Buffer.alloc(32, 0);
  let v = Buffer.alloc(32, 1);

  const b0 = Buffer.from([0x00]);
  const b1 = Buffer.from([0x01]);

  k = createHmac('sha256', k)
    .update(v)
    .update(b0)
    .update(privateKey)
    .update(hash)
    .update('')
    .digest();
  v = createHmac('sha256', k)
    .update(v)
    .digest();
  k = createHmac('sha256', k)
    .update(v)
    .update(b1)
    .update(privateKey)
    .update(hash)
    .update('')
    .digest();
  v = createHmac('sha256', k)
    .update(v)
    .digest();
  v = createHmac('sha256', k)
    .update(v)
    .digest();

  let T = bufferToBigInt(v);
  while (!isValidPrivateKey(T, curve)) {
    k = createHmac('sha256', k)
      .update(v)
      .update(b0)
      .digest();
    v = createHmac('sha256', k)
      .update(v)
      .digest();
    v = createHmac('sha256', k)
      .update(v)
      .digest();
    T = bufferToBigInt(v);
  }

  return T;
};

/**
 * Get the message hashed with `hash('\x19Ethereum Signed Message:\n32', hash(message))`. The hash used is Keccak-256,
 * and the output should match the hashes used by `eth_sign`.
 *
 * @param {status} message
 * @param {boolean} prefix
 * @return {Buffer}
 */
export const getHashedMessage = (message: string | Buffer, prefix = true): Buffer => {
  const messageHash = keccak256(Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8'));

  if (prefix) {
    return keccak256(Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n32', 'utf8'), messageHash]));
  }

  return messageHash;
};

/**
 * Sign a message with the private key. When `deterministic` is set to `true` (default), this will use RFC6979
 * to generate a deterministic k value, otherwise a random k value is used. If a chainId is specified, this will use
 * EIP-155 for the `v` value.
 *
 * Note that the message is automatically hashed and prefixed, to match the hashes used by `eth_sign`, unless `prefix`
 * is disabled.
 *
 * @param {string} message
 * @param {Buffer} privateKey
 * @param {boolean} [deterministic]
 * @param {boolean} [prefix]
 * @param {number} [chainId]
 * @param {Curve} [curve]
 */
export const sign = (
  message: string | Buffer,
  privateKey: Buffer,
  deterministic = true,
  prefix = true,
  chainId?: number,
  curve: Curve = secp256k1
): ECDSASignature => {
  const hash = getHashedMessage(message, prefix);

  const d = bufferToBigInt(privateKey);
  const e = bufferToBigInt(hash);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const k = deterministic ? generateK(hash, privateKey, curve) : random(curve);

    const { x, y } = pointMultiply(curve, curve.g, k);
    const r = mod(curve.n, x);
    if (r === 0n) {
      continue;
    }

    let s = mod(curve.n, modInverse(k, curve.n) * (e + d * r));
    if (s === 0n) {
      continue;
    }

    let v = (y % 2n === 0n ? 0 : 1) | (x === r ? 0 : 2);
    if (s > curve.n / 2n) {
      s = curve.n - s;
      v = v ^ 1;
    }

    v += chainId !== undefined ? chainId * 2 + 35 : 27;

    return {
      v,
      r,
      s
    };
  }
};

/**
 * Sign a transaction with a private key. Returns the RLP encoded signed transaction as Buffer.
 *
 * @param {Transaction} transaction
 * @param {number} chainId
 * @param {Buffer} privateKey
 * @return {Buffer}
 */
export const signTransaction = (transaction: Transaction, privateKey: Buffer): { raw: Buffer; signed: Buffer } => {
  const { nonce, gasPrice, gasLimit, to, value, data, chainId } = transaction;
  const input = [nonce, gasPrice, gasLimit, to, value, data];

  const raw = rlpEncode([...input, chainId ? numberToBuffer(chainId, 1) : 0, 0, 0]);
  const { r, s, v } = sign(raw, privateKey, true, false, chainId);

  const signed = rlpEncode([...input, v, Buffer.from(r.toString(16), 'hex'), Buffer.from(s.toString(16), 'hex')]);
  return { raw, signed };
};

/**
 * Verify a message with a signature and public key. Returns true if the signature is valid, or false otherwise.
 *
 * @param {string} message
 * @param {ECDSASignature} signature
 * @param {Buffer} publicKey
 * @param {Curve} [curve]
 */
export const verify = (
  message: string,
  { r, s }: ECDSASignature,
  publicKey: Buffer,
  curve: Curve = secp256k1
): boolean => {
  if (r > curve.n || s > curve.n || r <= 0 || s <= 0) {
    throw new Error('Invalid signature: r or s is out of range');
  }

  const hash = getHashedMessage(message);
  const e = bufferToBigInt(hash);

  const Qa = decodePoint(curve, publicKey);

  const sInv = modInverse(s, curve.n);
  const u1 = mod(curve.n, e * sInv);
  const u2 = mod(curve.n, r * sInv);

  const { x } = pointAdd(curve, pointMultiply(curve, curve.g, u1), pointMultiply(curve, Qa, u2));
  return mod(curve.n, x) === r;
};

/**
 * Recover an Ethereum address from a message and signature. Returns the address as string.
 *
 * @param {string} message
 * @param {ECDSASignature} signature
 * @param {Curve} [curve]
 */
export const recover = (message: string, { v, r, s }: ECDSASignature, curve: Curve = secp256k1): string => {
  if (r > curve.n || s > curve.n || r <= 0 || s <= 0) {
    throw new Error('Invalid signature: r or s is out of range');
  }

  const hash = getHashedMessage(message);
  const e = bufferToBigInt(hash);

  const isOdd = Boolean((v - 27) & 1);
  const isSecond = Boolean((v - 27) >> 1);

  if (r >= mod(curve.n, curve.p) && isSecond) {
    throw new Error('Unable to find second key');
  }

  const x = isSecond ? add(curve, r, curve.n) : r;
  const point = getPointFromX(curve, x, isOdd);

  const rInv = modInverse(r, curve.n);
  const u1 = mod(curve.n, -e * rInv);
  const u2 = mod(curve.n, s * rInv);

  const Qa = pointAdd(curve, pointMultiply(curve, curve.g, u1), pointMultiply(curve, point, u2));
  const publicKey = toBuffer(curve, Qa, false);

  return getAddress(publicKey);
};
