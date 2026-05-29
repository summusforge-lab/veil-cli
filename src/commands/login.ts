import { Command } from "commander";
import { password, isCancel, outro, intro } from "@clack/prompts";
import pc from "picocolors";
import { isHex } from "viem";
import { saveKey } from "../utils/storage.js";


export function registerLogin(program: Command) {
  program
    .command('login')
    .description('Securely encrypt and store your private key')
    .action(async () => {
      intro(pc.magenta("🔐 Veil Secure Login"));

      try {
        // 1. Ask for a vault password
        const vaultPassword = await password({
          message: "Set a password to encrypt your vault:",
          validate: (value) => {
            if (!value || value.length < 8) return "Password must be at least 8 characters long.";
          }
        });

        if (isCancel(vaultPassword)) {
          outro(pc.yellow("Login cancelled."));
          return;
        }

        // 2. Ask for the private key
        const privateKey = await password({
          message: "Paste your private key (0x...):",
          validate: (value) => {
            if (!value || !isHex(value) || value.length !== 66) {
              return "Invalid format. Must be a 64-character hex string starting with 0x.";
            }
          }
        });

        if (isCancel(privateKey)) {
          outro(pc.yellow("Login cancelled."));
          return;
        }

        // 3. Encrypt and Save
        await saveKey(privateKey as string, vaultPassword as string);

        outro(pc.green("✅ Private key encrypted and stored in ~/.veil/vault.json"));
      } catch (err) {
        outro(pc.red(`❌ An error occurred: ${err instanceof Error ? err.message : String(err)}`));
      }

    });
}
