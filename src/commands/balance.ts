import { Command } from "commander";
import { intro, outro, text, isCancel } from "@clack/prompts";
import pc from "picocolors";
import { createPublicClient, http, formatEther, isAddress } from "viem";
import { anvil } from "viem/chains";
import { resolveAddress } from "../utils/addressBook.js";


export function registerBalance(program:Command){
  program
      .command("balance")
      .description("Check ETH balance on local Anvil network")
      .action(async () => {
        intro(pc.cyan("💰 Veil Balance Checker (Anvil)"));

        const input = await text({
          message: "Enter address or alias:",
          placeholder: "0xf39Fd... or main",
          validate: (value) => {
            if (!value) return "Address is required.";
            if (!isAddress(value) && !value.match(/^[a-zA-Z0-9_-]+$/)) return "Invalid address or alias.";
          }
        });

        if(isCancel(input)){
          outro(pc.yellow("Cancelled."));
          return;
        }

        let resolved: string;
        try {
          resolved = resolveAddress(input as string);
        } catch (err: any) {
          outro(pc.red(err.message));
          return;
        }

        const client = createPublicClient({
          chain: anvil,
          transport: http(),
        });

        try{
          const balance = await client.getBalance({
            address: resolved as `0x${string}`
          });

          const ethBalance = formatEther(balance);

          outro(pc.green(`Balance: ${pc.bold(ethBalance)} ETH`));
        }
        catch(err){
          outro(pc.red("Error: Make sure Anvil is running on http://127.0.0.1:8545"));
        }
        
      });
}
