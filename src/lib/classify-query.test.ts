import { describe, expect, it } from 'vitest';
import { classifyQuery } from './classify-query';

describe('classifyQuery', () => {
  it('classifies a single word as dictionary', () => {
    expect(classifyQuery('hello')).toBe('dictionary');
  });

  it('classifies a short phrase as dictionary', () => {
    expect(classifyQuery('give up')).toBe('dictionary');
  });

  it('classifies four words without end punctuation as dictionary', () => {
    expect(classifyQuery('kick the bucket hard')).toBe('dictionary');
  });

  it('classifies five or more words as sentence', () => {
    expect(classifyQuery('How are you doing today')).toBe('sentence');
  });

  it('classifies text ending with sentence punctuation as sentence', () => {
    expect(classifyQuery('Give up!')).toBe('sentence');
  });

  it('ignores surrounding whitespace', () => {
    expect(classifyQuery('  hello  ')).toBe('dictionary');
  });

  it('classifies blank input as empty', () => {
    expect(classifyQuery('   ')).toBe('empty');
  });
});
