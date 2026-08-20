import type { TokenPair } from '@/api/types';

export interface TokenStore {
  get(): Promise<TokenPair | null>;
  set(tokens: TokenPair): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryTokenStore implements TokenStore {
  private tokens: TokenPair | null = null;

  async get() {
    return this.tokens;
  }

  async set(tokens: TokenPair) {
    this.tokens = tokens;
  }

  async clear() {
    this.tokens = null;
  }
}
