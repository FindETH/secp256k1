import { randomBytes } from 'crypto';
import { Curve } from './curve';
import { bufferToBigInt } from './utils';

/**
 * Get the modular result of an operation.
 *
 * @param {Curve} curve
 * @param {bigint} n
 * @return {bigint}
 */
export const mod = (curve: Curve | bigint, n: bigint): bigint => {
  if (typeof curve === 'bigint') {
    return ((n % curve) + curve) % curve;
  }

  return ((n % curve.p) + curve.p) % curve.p;
};

/**
 * Returns the greatest common divisor of a and b.
 *
 * @param {bigint} a
 * @param {bigint} b
 * @return {{ g: bigint, x: bigint, y: bigint }}
 */
export const eGcd = (a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } => {
  if (a <= 0 || b <= 0) {
    throw new Error('a and b must be larger than 0');
  }

  let [x, y, u, v] = [0n, 1n, 1n, 0n];
  while (a !== 0n) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    [b, a] = [a, r];
    [x, y] = [u, v];
    [u, v] = [m, n];
  }

  return { g: b, x, y };
};

/**
 * Get the ring of integers modulo n.
 *
 * @param {bigint} a
 * @param {bigint} n
 * @return {bigint}
 */
export const toZn = (a: bigint, n: bigint): bigint => {
  a = a % n;
  return a < 0 ? a + n : a;
};

/**
 * Returns the modular inverse.
 *
 * @param {bigint} a
 * @param {bigint} modulo
 */
export const modInverse = (a: bigint, modulo: bigint): bigint => {
  const { g, x } = eGcd(toZn(a, modulo), modulo);
  if (g !== 1n) {
    throw new Error('Modular inverse does not exist');
  }

  return toZn(x, modulo);
};

/**
 * a + b
 *
 * @param {Curve} curve
 * @param {bigint} a
 * @param {bigint} b
 * @return {bigint}
 */
export const add = (curve: Curve, a: bigint, b: bigint): bigint => {
  return mod(curve, a + b);
};

/**
 * a - b
 *
 * @param {Curve} curve
 * @param {bigint} a
 * @param {bigint} b
 * @return {bigint}
 */
export const subtract = (curve: Curve, a: bigint, b: bigint): bigint => {
  return mod(curve, a - b);
};

/**
 * a * b
 *
 * @param {Curve} curve
 * @param {bigint} a
 * @param {bigint} b
 * @return {bigint}
 */
export const multiply = (curve: Curve, a: bigint, b: bigint): bigint => {
  return mod(curve, a * b);
};

/**
 * a / b
 *
 * @param {Curve} curve
 * @param {bigint} a
 * @param {bigint} b
 * @return {bigint}
 */
export const divide = (curve: Curve, a: bigint, b: bigint): bigint => {
  const ap = power(curve, b, curve.p - 2n);
  return mod(curve, multiply(curve, a, ap));
};

/**
 * a ^ b
 *
 * @param {Curve} curve
 * @param {bigint} a
 * @param {bigint} b
 * @return {bigint}
 */
export const power = (curve: Curve, a: bigint, b: bigint): bigint => {
  let x = 1n;
  while (b > 0n) {
    if (a === 0n) {
      return 0n;
    }

    if (b % 2n === 1n) {
      x = multiply(curve, x, a);
    }

    b = b / 2n;
    a = multiply(curve, a, a);
  }

  return x;
};

/**
 * Get the square roots from a y² value on the curve.
 *
 * @param {Curve} curve
 * @param {bigint} value
 * @return {[bigint, bigint]}
 */
export const squareRoots = (curve: Curve, value: bigint): [bigint, bigint] => {
  const p1 = (curve.p - 1n) / 2n;
  const p2 = (curve.p + 1n) / 4n;

  if (power(curve, value, p1) !== 1n) {
    throw new Error('Square root is not an integer');
  }

  const root = power(curve, value, p2);
  const negativeRoot = curve.p - root;

  return [root, negativeRoot];
};

export const random = (curve: Curve): bigint => {
  const randomValue = randomBytes(64);
  return mod(curve.n, bufferToBigInt(randomValue));
};
