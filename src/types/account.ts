import { z } from 'zod';

export const SshKeyTypeSchema = z.enum(['ed25519', 'rsa']);
export type SshKeyType = z.infer<typeof SshKeyTypeSchema>;

export const SshKeyDetailsSchema = z.object({
  keyPath: z.string().min(1, 'Private key path is required'),
  publicKeyPath: z.string().min(1, 'Public key path is required'),
  hostAlias: z.string().min(1, 'SSH Host alias is required'),
  keyType: SshKeyTypeSchema.default('ed25519'),
});
export type SshKeyDetails = z.infer<typeof SshKeyDetailsSchema>;

export const AccountProfileSchema = z.object({
  id: z
    .string()
    .min(1, 'Account alias ID is required')
    .regex(/^[a-z0-9-_]+$/i, 'Alias must contain only alphanumeric characters, dashes, or underscores'),
  name: z.string().min(1, 'Display name is required'),
  username: z.string().min(1, 'GitHub username is required'),
  email: z.string().email('Invalid email address'),
  gitUserName: z.string().min(1, 'Git author name is required'),
  ssh: SshKeyDetailsSchema,
  signingKey: z.string().optional(),
  token: z.string().optional(),
  isDefaultGlobal: z.boolean().default(false),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type AccountProfile = z.infer<typeof AccountProfileSchema>;

export const CreateAccountInputSchema = z.object({
  id: z
    .string()
    .min(1, 'Alias is required')
    .regex(/^[a-z0-9-_]+$/i, 'Alias must contain only letters, numbers, dashes, or underscores'),
  name: z.string().optional(),
  username: z.string().min(1, 'GitHub username is required'),
  email: z.string().email('Valid email is required'),
  gitUserName: z.string().optional(),
  sshKeyPath: z.string().optional(),
  generateKey: z.boolean().default(true),
  keyType: SshKeyTypeSchema.default('ed25519'),
  hostAlias: z.string().optional(),
  token: z.string().optional(),
  setAsGlobal: z.boolean().default(false),
});
export type CreateAccountInput = z.input<typeof CreateAccountInputSchema>;
export type CreateAccountPayload = z.output<typeof CreateAccountInputSchema>;

export const UpdateAccountInputSchema = z.object({
  renameAlias: z
    .string()
    .min(1, 'New alias must not be empty')
    .regex(/^[a-z0-9-_]+$/i, 'New alias must contain only letters, numbers, dashes, or underscores')
    .optional(),
  name: z.string().optional(),
  username: z.string().min(1, 'Username cannot be empty').optional(),
  email: z.string().email('Invalid email address').optional(),
  gitUserName: z.string().min(1, 'Git author name cannot be empty').optional(),
  sshKeyPath: z.string().optional(),
  generateKey: z.boolean().optional(),
  keyType: SshKeyTypeSchema.optional(),
  deleteOldKey: z.boolean().optional(),
  hostAlias: z.string().optional(),
  signingKey: z.string().optional(),
  token: z.string().optional(),
  setAsGlobal: z.boolean().optional(),
});
export type UpdateAccountInput = z.input<typeof UpdateAccountInputSchema>;

