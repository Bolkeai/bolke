// Deprecated — all AI is now handled by Gemini Live API in hooks/useLiveAgent.ts
// Kept as a stub to avoid breaking any leftover imports during migration.

export const parseUserIntent = async (_transcript: string) => {
  throw new Error('geminiService is deprecated. Use useLiveAgent instead.');
};
