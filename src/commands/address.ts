import { Command } from "commander";
import { isAddress } from "viem";
import { addAddress, removeAddress, listAddresses } from "../utils/addressBook.js";

export function registerAddress(program: Command): void {
  const cmd = program
    .command("address")
    .description("Manage saved wallet addresses");

  cmd
    .command("add <alias> <address>")
    .description("Save an address under an alias")
    .action((alias, address) => {
      if (!isAddress(address)) {
        console.error(`Invalid Ethereum address: ${address}`);
        process.exit(1);
      }
      addAddress(alias, address);
      console.log(`Added "${alias}": ${address}`);
    });

  cmd
    .command("remove <alias>")
    .description("Remove a saved alias")
    .action((alias) => {
      removeAddress(alias);
      console.log(`Removed "${alias}"`);
    });

  cmd
    .command("list")
    .description("List all saved addresses")
    .action(() => {
      const addresses = listAddresses();
      if (Object.keys(addresses).length === 0) {
        console.log("Address book is empty");
        return;
      }
      for (const [alias, address] of Object.entries(addresses)) {
        console.log(`${alias}: ${address}`);
      }
    });
}
