import { Agent, Runner } from "@openai/agents";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredProviders } from "../../src/standalone/model-provider.js";
import { lunaModel, solModel } from "../../src/models/models.js";

describe("OpenRouter provider configuration", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("leaves the default providers alone unless explicitly selected", () => {
    expect(configuredProviders({}, {})).toEqual({});
  });

  it("routes all three roles through OpenRouter and prefixes model IDs", async () => {
    const getModel = vi.fn().mockResolvedValue({});
    const factory = vi.fn(() => ({ getModel }));
    const providers = configuredProviders(
      {},
      { POMERADO_MODEL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic-key" },
      factory,
    );
    expect(factory).toHaveBeenCalledWith("synthetic-key");
    expect(providers.guardianProvider).toBe(providers.minterProvider);
    expect(providers.outcomeReviewerProvider).toBe(providers.minterProvider);
    await providers.minterProvider!.getModel(solModel);
    await providers.guardianProvider!.getModel(lunaModel);
    expect(getModel.mock.calls.map(([name]) => name)).toEqual([`openai/${solModel}`, `openai/${lunaModel}`]);
  });

  it("requires a key and rejects unknown provider names", () => {
    expect(() => configuredProviders({}, { POMERADO_MODEL_PROVIDER: "openrouter" })).toThrow(/OPENROUTER_API_KEY/);
    expect(() => configuredProviders({}, { POMERADO_MODEL_PROVIDER: "other" })).toThrow(/POMERADO_MODEL_PROVIDER/);
  });

  it("preserves explicitly supplied providers", () => {
    const custom = { getModel: vi.fn() };
    const providers = configuredProviders({ minterProvider: custom }, { POMERADO_MODEL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic-key" });
    expect(providers.minterProvider).toBe(custom);
  });

  it("sends a Responses request to OpenRouter with the selected model and key", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      id: "resp_test", object: "response", created_at: 1, status: "completed",
      model: `openai/${lunaModel}`,
      output: [{ type: "message", id: "msg_test", role: "assistant", status: "completed", content: [{ type: "output_text", text: "ok", annotations: [] }] }],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const providers = configuredProviders({}, { POMERADO_MODEL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic-key" });
    const runner = new Runner({ modelProvider: providers.guardianProvider!, tracingDisabled: true });
    const result = await runner.run(new Agent({ name: "test", model: lunaModel }), "hello");
    expect(result.finalOutput).toBe("ok");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://openrouter.ai/api/v1/responses");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer synthetic-key");
    expect(JSON.parse(String(init.body)).model).toBe(`openai/${lunaModel}`);
  });
});
