import fs from "fs";
import path from "path";
import os from "os";

export type AddressBook = Record<string, string>;

const DATA_DIR = path.join(os.homedir(), ".veil");
const ADDRESS_BOOK_PATH = path.join(DATA_DIR, "address-book.json");

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(ADDRESS_BOOK_PATH)) {
    fs.writeFileSync(ADDRESS_BOOK_PATH, JSON.stringify({}, null, 2));
  }
}

function readAddressBook(): AddressBook {
  ensureStorage();

  const raw = fs.readFileSync(ADDRESS_BOOK_PATH, "utf8");

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeAddressBook(book: AddressBook): void {
  ensureStorage();

  fs.writeFileSync(
    ADDRESS_BOOK_PATH,
    JSON.stringify(book, null, 2),
    "utf8"
  );
}

export function addAddress(alias: string, address: string): void {
  const book = readAddressBook();

  if (book[alias]) {
    throw new Error(`Alias "${alias}" already exists`);
  }

  book[alias] = address;

  writeAddressBook(book);
}

export function removeAddress(alias: string): void {
  const book = readAddressBook();

  if (!book[alias]) {
    throw new Error(`Alias "${alias}" not found`);
  }

  delete book[alias];

  writeAddressBook(book);
}

export function listAddresses(): AddressBook {
  return readAddressBook();
}

export function getAddress(alias: string): string | undefined {
  const book = readAddressBook();

  return book[alias];
}

export function resolveAddress(input: string): string {
  if (input.startsWith("0x")) return input;
  const address = getAddress(input);
  if (!address) throw new Error(`Alias "${input}" not found`);
  return address;
}
