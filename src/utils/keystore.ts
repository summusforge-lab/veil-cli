import crypto from "crypto";
import { keccak256, type Hex } from "viem";

export interface KeystoreV3 {
  address: string;
  id: string;
  version: number;
  crypto: {
    cipher: string;
    ciphertext: string;
    cipherparams: {
      iv: string;
    };
    kdf: string;
    kdfparams: {
      dklen: number;
      salt: string;
      n: number;
      r: number;
      p: number;
    };
    mac: string;
  };
}

export async function encryptKeystore(
  privateKey: Hex,
  password: string,
  address: string
): Promise<KeystoreV3> {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const id = crypto.randomUUID();

  // Параметри Scrypt (стандартні для Ethereum)
  const n = 131072;
  const r = 8;
  const p = 1;
  const dklen = 32;

  // Використовуємо проміси для scrypt
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    // N=131072 потребує ~128MB пам'яті. Стандартний ліміт Node.js - 32MB.
    const maxmem = 1024 * 1024 * 160; // 160MB
    crypto.scrypt(password, salt, dklen, { N: n, r, p, maxmem }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  const encryptKey = derivedKey.subarray(0, 16);
  const macKey = derivedKey.subarray(16, 32);

  const cipher = crypto.createCipheriv("aes-128-ctr", encryptKey, iv);
  const privateKeyBuffer = Buffer.from(privateKey.replace('0x', ''), 'hex');
  const ciphertext = Buffer.concat([cipher.update(privateKeyBuffer), cipher.final()]);

  // MAC = keccak256(macKey + ciphertext)
  const macInput = Buffer.concat([macKey, ciphertext]);
  const mac = keccak256(`0x${macInput.toString('hex')}`);

  return {
    address: address.replace('0x', '').toLowerCase(),
    id,
    version: 3,
    crypto: {
      cipher: "aes-128-ctr",
      ciphertext: ciphertext.toString("hex"),
      cipherparams: {
        iv: iv.toString("hex"),
      },
      kdf: "scrypt",
      kdfparams: {
        dklen,
        salt: salt.toString("hex"),
        n,
        r,
        p,
      },
      mac: mac.replace('0x', ''),
    },
  };
}

export async function decryptKeystore(
  keystore: KeystoreV3,
  password: string
): Promise<Hex> {
  const { crypto: c } = keystore;
  
  if (c.kdf !== "scrypt") {
    throw new Error(`Unsupported KDF: ${c.kdf}`);
  }

  if (c.cipher !== "aes-128-ctr") {
    throw new Error(`Unsupported cipher: ${c.cipher}`);
  }

  const salt = Buffer.from(c.kdfparams.salt, "hex");
  const { n, r, p, dklen } = c.kdfparams;

  // Деривація ключа
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    const maxmem = 1024 * 1024 * 160;
    crypto.scrypt(password, salt, dklen, { N: n, r, p, maxmem }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  const macKey = derivedKey.subarray(16, 32);
  const ciphertext = Buffer.from(c.ciphertext, "hex");

  // Перевірка MAC
  const macInput = Buffer.concat([macKey, ciphertext]);
  const mac = keccak256(`0x${macInput.toString('hex')}`).replace('0x', '');

  if (!crypto.timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(c.mac, 'hex'))) {
    throw new Error("Invalid password");
  }

  const encryptKey = derivedKey.subarray(0, 16);
  const iv = Buffer.from(c.cipherparams.iv, "hex");

  // Розшифрування
  const decipher = crypto.createDecipheriv("aes-128-ctr", encryptKey, iv);
  const privateKey = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return `0x${privateKey.toString("hex")}`;
}
