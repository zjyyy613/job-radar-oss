import { expect, it, vi } from "vitest";
import { createDeepSeekModel, deepseekConfig, extractionPrompt } from "../../scripts/ingest/deepseek-responses";

const job = { title: "27届", requirements: "复杂要求", description: null };
const config = { base: "https://api.deepseek.com", key: "test-key", model: "deepseek-flash" };
it("keeps the validator invariants stated in the prompt", () => {
  // Each statement prevents a rejection class seen in production. Dropping one
  // silently reintroduces those failures, so the contract is pinned here.
  expect(extractionPrompt).toContain('NEVER emit requirement "required"');
  expect(extractionPrompt).toContain("ARABIC DIGITS");
  expect(extractionPrompt).toContain("在校生");
  expect(extractionPrompt).toContain("及以上/以上");
  expect(extractionPrompt).toContain("branches MUST be []");
  expect(extractionPrompt).toContain("优先/更佳/加分/优选");
  // Success rate must never be raised by relaxing a frozen rule.
  expect(extractionPrompt).not.toMatch(/skip validation|ignore evidence|do not validate/i);
});
it("uses Responses structured output exclusively, closed schema, bounded transport", async () => {
  const payload = { gates: [], metadata: [] };
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] }] })));
  expect(await createDeepSeekModel(config, request)(job, [])).toEqual(payload);
  expect(String(request.mock.calls[0][0])).toBe("https://api.deepseek.com/responses");
  const options = request.mock.calls[0][1]!;
  const body = JSON.parse(String(options.body));
  expect(body.model).toBe("deepseek-flash");
  expect(body.text.format).toMatchObject({ type: "json_schema", schema: { additionalProperties: false, required: ["gates", "metadata"] } });
  expect(options.redirect).toBe("error");
  expect(body.input[1].content).not.toContain(config.key);
});
it.each([
  { status: "incomplete", output_text: "{}" }, { status: "completed", output_text: "not JSON" },
  { status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] },
])("rejects malformed/refused/incomplete response without returning provider content", async response => {
  await expect(createDeepSeekModel(config, vi.fn().mockResolvedValue(new Response(JSON.stringify(response))))(job, [])).rejects.toThrow("model_output_invalid");
});
it("does not expose transport/HTTP error bodies or API keys", async () => {
  await expect(createDeepSeekModel(config, vi.fn().mockRejectedValue(new Error("private key text")))(job, [])).rejects.toThrow("model_transport_failed");
  await expect(createDeepSeekModel(config, vi.fn().mockResolvedValue(new Response("private upstream body", { status: 403 })))(job, [])).rejects.toThrow("model_http_403");
  expect(() => deepseekConfig({ NODE_ENV: "test", DEEPSEEK_API_KEY: "test", DEEPSEEK_BASE_URL: "https://untrusted.example" })).toThrow("Invalid server DeepSeek configuration");
});
