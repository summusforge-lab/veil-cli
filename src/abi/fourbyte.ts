import { type Abi, type AbiFunction, parseAbiItem } from 'viem';

interface FourByteResponse {
  results: Array<{ text_signature: string }>;
}

export async function fetchAbiFrom4Byte(selector: string): Promise<Abi | null> {
  // selector — перші 4 байти calldata у вигляді '0xaabbccdd'
  try {
    const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json() as FourByteResponse;
    if (!data.results.length) return null;

    // Беремо першу (найпопулярнішу) сигнатуру
    const sig = data.results[0]!.text_signature;

    const item = parseAbiItem(`function ${sig}`) as AbiFunction;
    return [item];
  } catch {
    return null;
  }
}
