// src/utils/crypto.ts
import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt a camera password using AES-256-GCM.
 * Returns a base64 string of: IV + ciphertext + auth tag
 */
export function encryptPassword(plaintext: string): string {
  const key = Buffer.from(env.CAMERA_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: IV (16) + encrypted + tag (16)
  const result = Buffer.concat([iv, encrypted, tag]);
  return result.toString('base64');
}

/**
 * Decrypt a camera password.
 * Input: base64 string produced by encryptPassword.
 */
export function decryptPassword(ciphertext: string): string {
  const key = Buffer.from(env.CAMERA_ENCRYPTION_KEY, 'hex');
  const data = Buffer.from(ciphertext, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}
