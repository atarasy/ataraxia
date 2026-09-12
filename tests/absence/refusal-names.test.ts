import { expect, test } from "bun:test";

// §3.3 and §16.6. Status alone does not establish the specified error name.
// NOTE (mutation check, 2026-09-13): unknown_field_refusal_renamed
// preserved 400 and returned unknown_field. This probe failed against the
// isolated reference HTTP handler. It passes with the specified malformed.
test("absence: unknown fields carry the specified malformed error", async () => {
  const base = process.env.VALENCE_BASE_URL;
  if (!base) throw new Error("VALENCE_BASE_URL is required");
  const response = await fetch(`${base}/offers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ discount: 1 }),
  });
  expect(response.status).toBe(400);
  expect((await response.json() as { error: string }).error).toBe("malformed");
});
