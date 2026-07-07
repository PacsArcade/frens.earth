/** NIP-07 browser extension surface — one shared declaration so every
    component sees the same window.nostr. */
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: {
        kind: number;
        created_at: number;
        tags: string[][];
        content: string;
      }): Promise<{ id: string; pubkey: string; sig: string } & Record<string, unknown>>;
    };
  }
}

export {};
