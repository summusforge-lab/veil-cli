import { z } from 'zod';

const HexString = z.string().regex(/^0x[0-9a-fA-F]*$/, 'Must be 0x-prefixed hex');
const AddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid address');

export const TxRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  value: HexString.optional(),   // wei, hex-encoded
  data: HexString.optional(),   // calldata
  gas: HexString.optional(),
  gasPrice: HexString.optional(),
});

export type TxRequest = z.infer<typeof TxRequestSchema>;
