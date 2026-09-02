export const LABEL_PATTERNS = [
  /\byou are\b/i,
  /\byou're a\b/i,
  /\b(intj|enfp|istp|infj|entp|esfj|isfp|estj)\b/i,
  /\b(manager|engineer|designer|nurse|teacher|founder|analyst|consultant|developer|lawyer|doctor|marketer|accountant)\b/i,
  /\b(introvert|extrovert|perfectionist|leader|creative|analytical|empath)\b/i,
  /\bshould\b/i,
  /\bcareer\b/i,
] as const;

export function isLabel(text: string): boolean {
  return LABEL_PATTERNS.some((pattern) => pattern.test(text));
}

export function isMoment(text: string): boolean {
  return text.length >= 20 && text.length <= 140 && /\byou\b|\byour\b|\byou're\b/i.test(text) && !isLabel(text);
}

export function isTensionClaim(text: string): boolean {
  if (text.length < 20 || text.length > 160 || isLabel(text)) return false;
  return /\b(and|but|while|yet)\b/i.test(text);
}
