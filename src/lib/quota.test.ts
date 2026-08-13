import { describe, expect, it } from 'vitest';
import { FREE_QUESTIONS, hasQuestionsLeft, isChargeable, quotaState } from './quota.ts';

describe('quotaState', () => {
  it('counts down from the free allowance', () => {
    expect(quotaState(0, false).remaining).toBe(FREE_QUESTIONS);
    expect(quotaState(1, false).remaining).toBe(FREE_QUESTIONS - 1);
    expect(quotaState(FREE_QUESTIONS, false).remaining).toBe(0);
  });

  it('never goes negative', () => {
    // Two turns racing to spend the last question would otherwise render
    // "quedan -1", and the paywall would still be reachable by arithmetic.
    expect(quotaState(FREE_QUESTIONS + 5, false).remaining).toBe(0);
  });

  it('is unlimited for a subscriber', () => {
    expect(quotaState(99, true).unlimited).toBe(true);
    expect(quotaState(99, true).remaining).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('hasQuestionsLeft', () => {
  it('closes exactly at the allowance', () => {
    expect(hasQuestionsLeft(FREE_QUESTIONS - 1, false)).toBe(true);
    expect(hasQuestionsLeft(FREE_QUESTIONS, false)).toBe(false);
  });

  it('stays open for a subscriber at any count', () => {
    expect(hasQuestionsLeft(FREE_QUESTIONS + 100, true)).toBe(true);
  });
});

describe('isChargeable', () => {
  it('charges for the three ordinary response types', () => {
    expect(isChargeable('reflection')).toBe(true);
    expect(isChargeable('recommendation')).toBe(true);
    expect(isChargeable('clarifying_question')).toBe(true);
  });

  it('never charges for containment', () => {
    // PDR 1.6. Billing somebody for being handed a hotline is the single worst
    // line item this product could have.
    expect(isChargeable('crisis')).toBe(false);
  });
});
