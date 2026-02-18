// Approximate token counter (4 chars ≈ 1 token for English text)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: { role: string; content: string }[]): number {
  let total = 0;
  for (const msg of messages) {
    total += 4; // message overhead
    total += estimateTokens(msg.role);
    total += estimateTokens(msg.content);
  }
  return total;
}
