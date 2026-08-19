import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MONTHLY_BUDGET_USD,
  addUsage,
  MAX_OUTPUT_TOKENS,
  PURPOSE_LIMITS,
  costUsd,
  monthlyBudgetUsd,
  type Purpose,
} from './budget.ts';

const PURPOSES: Purpose[] = ['soul_map', 'match', 'chat', 'meditation', 'comparison'];

describe('what a call costs', () => {
  it('prices input and output separately', () => {
    // A Soul Map with a real natal chart: about 3k in, 1.2k out.
    expect(costUsd({ inputTokens: 3_000, outputTokens: 1_200 })).toBeCloseTo(0.045, 3);
  });

  it('is dominated by output, which is why the ceilings are on output', () => {
    expect(costUsd({ inputTokens: 0, outputTokens: 1_000 })).toBeGreaterThan(
      costUsd({ inputTokens: 1_000, outputTokens: 0 }),
    );
  });

  it('costs nothing for a call that produced nothing', () => {
    expect(costUsd({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});

describe('the cache, which was being counted as free', () => {
  it('charges more to write than to read, and both are non-zero', () => {
    // The bug this replaced: both were absent from the sum, so a call that
    // wrote 1,926 tokens to the cache recorded as if it had written none.
    const write = costUsd({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000 });
    const read = costUsd({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000 });
    expect(write).toBeGreaterThan(0);
    expect(read).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(read);
  });

  it('prices a cold cache above the same call with no caching at all', () => {
    // Why the measurement matters. Writing costs 1.25x; if the prefix is
    // never read back the marker is a surcharge and nothing else.
    const cold = costUsd({ inputTokens: 100, outputTokens: 500, cacheWriteTokens: 1_900 });
    const uncached = costUsd({ inputTokens: 2_000, outputTokens: 500 });
    expect(cold).toBeGreaterThan(uncached);
  });

  it('prices a warm cache below it', () => {
    const warm = costUsd({ inputTokens: 100, outputTokens: 500, cacheReadTokens: 1_900 });
    const uncached = costUsd({ inputTokens: 2_000, outputTokens: 500 });
    expect(warm).toBeLessThan(uncached);
  });
});

describe('adding two attempts', () => {
  it('sums a retry on top of the attempt it followed', () => {
    // The reason this exists: keeping only the last attempt under-reports by
    // exactly the amount that made retrying expensive.
    const both = addUsage(
      { inputTokens: 300, outputTokens: 2_000, cacheWriteTokens: 1_900, cacheReadTokens: 0 },
      { inputTokens: 300, outputTokens: 2_100, cacheWriteTokens: 0, cacheReadTokens: 1_900 },
    );
    expect(both).toEqual({
      inputTokens: 600,
      outputTokens: 4_100,
      cacheWriteTokens: 1_900,
      cacheReadTokens: 1_900,
    });
  });

  it('keeps an absence rather than turning it into a zero', () => {
    // A call that never reached the model has no usage, and `0` would be a
    // claim about what it cost instead of an admission that nobody knows.
    expect(addUsage(undefined, undefined)).toBeUndefined();
    const only = { inputTokens: 10, outputTokens: 20 };
    expect(addUsage(undefined, only)).toBe(only);
    expect(addUsage(only, undefined)).toBe(only);
  });

  it('treats one attempt reaching the model and one not as one attempt', () => {
    const both = addUsage({ inputTokens: null, outputTokens: null }, { inputTokens: 300, outputTokens: 2_000 });
    expect(both?.inputTokens).toBe(300);
    expect(both?.outputTokens).toBe(2_000);
  });

  it('prices a failed pair of attempts at more than nothing', () => {
    // The bug this whole change closes: two comparison calls generated four
    // thousand tokens each, failed their schema, and were recorded as free.
    const failed = addUsage(
      { inputTokens: 288, outputTokens: 4_300 },
      { inputTokens: 288, outputTokens: 4_300 },
    );
    expect(costUsd(failed ?? {})).toBeGreaterThan(0.2);
  });
});

describe('the deployment budget', () => {
  it('reads a configured value', () => {
    expect(monthlyBudgetUsd('120')).toBe(120);
  });

  it.each([undefined, '', 'mucho', '0', '-5', 'NaN'])(
    'falls back to the default rather than to nothing for %s',
    (configured) => {
      // The failure mode being avoided: a typo in an environment variable
      // parsing to 0 and refusing every call, or to NaN and refusing none.
      expect(monthlyBudgetUsd(configured)).toBe(DEFAULT_MONTHLY_BUDGET_USD);
    },
  );
});

describe('every purpose has a ceiling on what one answer can cost', () => {
  it.each(PURPOSES)('%s has a max_tokens', (purpose) => {
    expect(MAX_OUTPUT_TOKENS[purpose]).toBeGreaterThan(0);
  });

  it('never lets one answer cost more than a dollar', () => {
    // The bound that matters: whatever the model does, one call cannot run
    // away. Input is bounded separately by the schemas in `model-input.ts`.
    for (const purpose of PURPOSES) {
      expect(costUsd({ inputTokens: 0, outputTokens: MAX_OUTPUT_TOKENS[purpose] })).toBeLessThan(1);
    }
  });

  it('gives the chat less room than the document surfaces', () => {
    expect(MAX_OUTPUT_TOKENS.chat).toBeLessThan(MAX_OUTPUT_TOKENS.soul_map);
    expect(MAX_OUTPUT_TOKENS.chat).toBeLessThan(MAX_OUTPUT_TOKENS.meditation);
  });
});

describe('per-person limits', () => {
  it('covers every purpose except the chat', () => {
    // The chat's limit is FREE_QUESTIONS and lives in `quota.ts`. Two numbers
    // answering the same question is how they come to disagree.
    const covered = Object.keys(PURPOSE_LIMITS).sort();
    expect(covered).toEqual(['comparison', 'match', 'meditation', 'soul_map']);
  });

  it('sits far enough above ordinary use to mean something went wrong', () => {
    // Nobody regenerates their Soul Map ten times in a month by using the
    // product. Reaching one of these is a loop or an attempt.
    expect(PURPOSE_LIMITS.soul_map.calls).toBeGreaterThanOrEqual(5);
    for (const limit of Object.values(PURPOSE_LIMITS)) {
      expect(limit.windowHours).toBeGreaterThan(0);
      expect(limit.calls).toBeGreaterThan(0);
    }
  });

  it('measures every window in the same unit, so the sum below is real', () => {
    // The first draft mixed daily and monthly windows. Twenty a day reads as
    // a modest number and is six hundred a month.
    for (const limit of Object.values(PURPOSE_LIMITS)) {
      expect(limit.windowHours).toBe(720);
    }
  });

  it('bounds one person to a fraction of the deployment budget', () => {
    // Worst case for a single person across a month, every purpose at its
    // ceiling and every answer at its maximum length. One person must not be
    // able to consume the deployment, or the deployment budget is the only
    // limit there is and it arrives as an outage for everyone else.
    const worst = Object.entries(PURPOSE_LIMITS).reduce(
      (total, [purpose, limit]) =>
        total +
        limit.calls *
          costUsd({ inputTokens: 4_000, outputTokens: MAX_OUTPUT_TOKENS[purpose as Purpose] }),
      0,
    );
    expect(worst).toBeLessThan(DEFAULT_MONTHLY_BUDGET_USD / 3);
  });

  it('leaves room for a fifty-person pilot inside the budget', () => {
    // What ordinary use actually costs: one Soul Map with a chart, one match,
    // a couple of meditations and the three free chat questions.
    const perPerson =
      costUsd({ inputTokens: 3_000, outputTokens: 1_200 }) +
      costUsd({ inputTokens: 2_000, outputTokens: 900 }) +
      2 * costUsd({ inputTokens: 1_200, outputTokens: 1_500 }) +
      3 * costUsd({ inputTokens: 1_500, outputTokens: 400 });
    expect(perPerson * 50).toBeLessThan(DEFAULT_MONTHLY_BUDGET_USD / 2);
  });
});
