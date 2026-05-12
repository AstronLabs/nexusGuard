import * as StellarSdk from '@stellar/stellar-sdk';
import { config } from '../config';

/**
 * Stellar SDK helper utilities for the backend.
 */

/** Get a Keypair from the backend's configured secret key. */
export function getBackendKeypair(): StellarSdk.Keypair {
  if (!config.stellar.secretKey) {
    throw new Error('STELLAR_SECRET_KEY is not configured');
  }
  return StellarSdk.Keypair.fromSecret(config.stellar.secretKey);
}

/** Get a configured Soroban RPC client. */
export function getSorobanClient(): StellarSdk.SorobanRpc.Server {
  return new StellarSdk.SorobanRpc.Server(config.stellar.rpcUrl);
}

/** Get the network passphrase. */
export function getNetworkPassphrase(): string {
  return config.stellar.networkPassphrase;
}

/** Convert a Stellar stroop amount (i128) to a human-readable decimal string. */
export function stroopsToDecimal(stroops: bigint | number, decimals: number = 7): string {
  const divisor = BigInt(10 ** decimals);
  const amount = BigInt(stroops);
  const whole = amount / divisor;
  const fractional = amount % divisor;
  const fracStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/** Convert a human-readable decimal string to stroops (i128). */
export function decimalToStroops(decimal: string, decimals: number = 7): bigint {
  const parts = decimal.split('.');
  const whole = BigInt(parts[0]) * BigInt(10 ** decimals);
  if (parts[1]) {
    const frac = parts[1].padEnd(decimals, '0').slice(0, decimals);
    return whole + BigInt(frac);
  }
  return whole;
}

/** Validate a Stellar public key format. */
export function isValidStellarAddress(address: string): boolean {
  try {
    StellarSdk.Keypair.fromPublicKey(address);
    return true;
  } catch {
    return false;
  }
}
