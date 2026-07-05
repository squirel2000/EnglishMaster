import type { QueryKind } from './types';

const MAX_PHRASE_WORDS = 4;
const SENTENCE_END = /[.!?]$/;

export function classifyQuery(input: string): QueryKind {
  const trimmed = input.trim();
  if (trimmed === '') return 'empty';
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= MAX_PHRASE_WORDS && !SENTENCE_END.test(trimmed)) {
    return 'dictionary';
  }
  return 'sentence';
}
