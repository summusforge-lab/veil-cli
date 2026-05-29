import fs, { existsSync } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const STORAGE_DIR = path.join(os.homedir(), '.veil');
const STORAGE_FILE = path.join(STORAGE_DIR, 'vault.json');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

// Параметри для Scrypt: N (cost), r (block size), p (parallelization)
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export async function saveKey(privateKey: string, password: string) {
  if (!existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Генеруємо ключ із пароля за допомогою Scrypt (sync для простоти в CLI)
  const key = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const data = {
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    tag: tag.toString('hex'),
    encrypted: encrypted.toString('hex')
  };

  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data));
}

export async function loadKey(password: string): Promise<string> {
  if (!existsSync(STORAGE_FILE)) {
    throw new Error("Vault file not found. Please login first.");
  }

  const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
  const iv = Buffer.from(data.iv, 'hex');
  const salt = Buffer.from(data.salt, 'hex');
  const tag = Buffer.from(data.tag, 'hex');
  const encrypted = Buffer.from(data.encrypted, 'hex');

  // Відтворюємо ключ за допомогою Scrypt
  const key = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
