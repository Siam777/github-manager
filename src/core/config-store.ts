import fs from 'node:fs';
import path from 'node:path';
import { getConfigFilePath } from '../platform/paths.js';
import { DEFAULT_CONFIG, OctomuxConfig, OctomuxConfigSchema } from '../types/config.js';
import { AccountProfile } from '../types/account.js';

export class ConfigStore {
  private readonly configPath: string;

  constructor(customConfigPath?: string) {
    this.configPath = customConfigPath ?? getConfigFilePath();
  }

  /**
   * Returns the config file path being managed.
   */
  public getPath(): string {
    return this.configPath;
  }

  /**
   * Loads and validates the octomux configuration.
   * If file does not exist, creates it with DEFAULT_CONFIG.
   */
  public load(): OctomuxConfig {
    if (!fs.existsSync(this.configPath)) {
      this.save(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const validated = OctomuxConfigSchema.parse(parsed);
      return validated;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Corrupted config file at ${this.configPath}: Invalid JSON format.`);
      }
      throw error;
    }
  }

  /**
   * Atomically saves the configuration with backup creation.
   */
  public save(config: OctomuxConfig): void {
    const validated = OctomuxConfigSchema.parse(config);
    const dir = path.dirname(this.configPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create backup if previous config exists
    if (fs.existsSync(this.configPath)) {
      const backupPath = `${this.configPath}.bak`;
      try {
        fs.copyFileSync(this.configPath, backupPath);
      } catch {
        // Backup failure should not prevent writing
      }
    }

    const tempPath = `${this.configPath}.${Date.now()}.tmp`;
    const serialized = JSON.stringify(validated, null, 2);

    fs.writeFileSync(tempPath, serialized, 'utf-8');
    fs.renameSync(tempPath, this.configPath);
  }

  /**
   * Retrieves all configured account profiles.
   */
  public getAccounts(): Record<string, AccountProfile> {
    const config = this.load();
    return config.accounts;
  }

  /**
   * Retrieves a single account profile by its alias.
   */
  public getAccount(alias: string): AccountProfile | undefined {
    const accounts = this.getAccounts();
    return accounts[alias];
  }

  /**
   * Saves or updates an account profile.
   */
  public setAccount(account: AccountProfile): void {
    const config = this.load();
    config.accounts[account.id] = account;

    if (account.isDefaultGlobal) {
      config.activeGlobalAccount = account.id;
      // Mark others as non-default
      for (const [id, acc] of Object.entries(config.accounts)) {
        if (id !== account.id) {
          acc.isDefaultGlobal = false;
        }
      }
    }

    this.save(config);
  }

  /**
   * Removes an account profile by alias.
   */
  public removeAccount(alias: string): boolean {
    const config = this.load();
    if (!config.accounts[alias]) {
      return false;
    }

    delete config.accounts[alias];
    if (config.activeGlobalAccount === alias) {
      delete config.activeGlobalAccount;
    }

    this.save(config);
    return true;
  }

  /**
   * Sets the active global account alias.
   */
  public setActiveGlobal(alias: string): void {
    const config = this.load();
    if (!config.accounts[alias]) {
      throw new Error(`Cannot set active global account: Profile '${alias}' does not exist.`);
    }

    config.activeGlobalAccount = alias;
    for (const [id, acc] of Object.entries(config.accounts)) {
      acc.isDefaultGlobal = id === alias;
    }

    this.save(config);
  }

  /**
   * Gets the active global account profile if one is set.
   */
  public getActiveGlobal(): AccountProfile | undefined {
    const config = this.load();
    if (!config.activeGlobalAccount) {
      return undefined;
    }
    return config.accounts[config.activeGlobalAccount];
  }
}
