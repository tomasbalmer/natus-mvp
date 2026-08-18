/**
 * Reading JSON back out of a model's answer.
 *
 * This lives in `src/lib` rather than beside the browser client because the
 * Edge Functions now run the same prompts against the same contracts. Two
 * tolerant parsers would eventually tolerate different things, and the
 * divergence would show up as a surface that works in the browser and fails on
 * the server for input neither author ever saw. `shared-parity.test.ts` keeps
 * the copy honest.
 *
 * It throws a bare error rather than the caller's error type on purpose: the
 * browser wraps this in `AiError` and the server in `ModelError`, and neither
 * of those can cross the boundary.
 */

export class MalformedJson extends Error {}

/**
 * Models wrap JSON in prose or a code fence often enough that refusing to
 * cope is a worse contract than tolerating it. The schema still decides
 * whether the result is usable.
 */
export function parseJsonLoosely(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new MalformedJson('The model did not return JSON');
    }
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      throw new MalformedJson('The model returned malformed JSON');
    }
  }
}
