import * as SecureStore from 'expo-secure-store';

import type { TokenPair } from '@/api/types';
import type { TokenStore } from './token-store';

const KEY = 'algowealth.tokens';

export class SecureTokenStore implements TokenStore {
  async get(): Promise<TokenPair | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenPair;
    } catch {
      return null;
    }
  }

  async set(tokens: TokenPair): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  }
}
