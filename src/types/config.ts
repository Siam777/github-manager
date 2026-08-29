import { z } from 'zod';
import { AccountProfileSchema } from './account.js';

export const OctomuxConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  activeGlobalAccount: z.string().optional(),
  defaultCloneProtocol: z.enum(['ssh', 'https']).default('ssh'),
  accounts: z.record(z.string(), AccountProfileSchema).default({}),
});
export type OctomuxConfig = z.infer<typeof OctomuxConfigSchema>;

export const DEFAULT_CONFIG: OctomuxConfig = {
  version: '1.0.0',
  defaultCloneProtocol: 'ssh',
  accounts: {},
};
