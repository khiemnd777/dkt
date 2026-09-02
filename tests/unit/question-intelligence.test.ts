import { describe, expect, it } from "vitest";
import type { ScriptureProvider } from "../../shared/scripture";
import { OpenAiResponsesProvider } from "../../worker/integrations/openai/responses-provider";
import {
  draftRecommendations,
  selectBalancedTypes,
  targetDifficulties,
} from "../../worker/question-intelligence/auto-balance";
import { sanitizeGenerationProvenance } from "../../worker/question-intelligence/provenance-validation";
import type { AiModelProvider } from "../../worker/question-intelligence/provider";
import { QuestionIntelligenceService } from "../../worker/question-intelligence/service";
import { parseScriptureReference } from "../../worker/scripture/reference";
import { ScriptureService } from "../../worker/scripture/service";

const reference = parseScriptureReference(449, "JHN.3.16-18");
const scriptureProvider: ScriptureProvider = {
  listVersions: async () => [],
  getVersion: async () => ({
    provider: "youversion",
    id: 449,
    abbreviation: "NVB",
    localizedTitle: "Kinh Thánh Tiếng Việt",
    languageTag: "vi",
    copyright: "Bản quyền thử nghiệm",
    attribution: "NVB · Bản quyền thử nghiệm",
  }),
  getIndex: async () => ({
    provider: "youversion",
    bibleVersionId: 449,
    books: [
      {
        id: "JHN",
        name: "Giăng",
        abbreviation: "Gi",
        chapters: [
          {
            id: "JHN.3",
            number: 3,
            verses: [16, 17, 18].map((number) => ({ id: `JHN.3.${number}`, number })),
          },
        ],
      },
    ],
  }),
  getPassage: async () => ({
    reference,
    localizedReference: "Giăng 3:16–18",
    content:
      "Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con Một của Ngài. Ai tin Con ấy không bị đoán xét.",
    contentSha256: "a".repeat(64),
    attribution: "NVB · Bản quyền thử nghiệm",
  }),
  validateReference: async (candidate) => ({ valid: true, reference: candidate }),
};

const baseProposal = {
  presentation: {
    text: "Hãy chọn mọi đáp án đúng.",
    useProvidedMedia: false,
    publicAccessibilityText: null,
  },
  evidence: [
    {
      passageId: "JHN.3.16",
      supportingExcerpt: "Đức Chúa Trời yêu thương thế gian",
      claimSupported: "Đức Chúa Trời yêu thế gian và ban Con Một.",
    },
  ],
  proposedDifficulty: { label: "MEDIUM", featureReasons: ["Cần nhận biết hai mệnh đề."] },
  explanation: "Phân đoạn nói đến tình yêu và việc ban Con Một.",
  uncertaintyNotes: [],
};

describe("OpenAI Responses provider", () => {
  it("uses store:false and strict Structured Outputs without tools", async () => {
    let body: Record<string, unknown> | undefined;
    const provider = new OpenAiResponsesProvider({
      apiKey: "test-openai-key",
      fetcher: async (_input, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          id: "resp_test",
          model: "gpt-5.6-terra",
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify({ proposals: [] }) }],
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      },
    });
    const result = await provider.generateStructured<{ proposals: unknown[] }>({
      model: "gpt-5.6-terra",
      schemaName: "test_schema",
      schema: { type: "object" },
      instructions: "Return test data.",
      data: { value: "untrusted" },
      reasoningEffort: "low",
    });
    expect(result.value).toEqual({ proposals: [] });
    expect(body).toMatchObject({
      model: "gpt-5.6-terra",
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "test_schema", strict: true } },
    });
    expect(body).not.toHaveProperty("tools");
    expect(JSON.stringify(body)).not.toContain("test-openai-key");
  });

  it("maps refusals and rate limits to stable application errors", async () => {
    const refusal = new OpenAiResponsesProvider({
      apiKey: "test",
      fetcher: async () =>
        Response.json({
          model: "gpt-5.6-terra",
          status: "completed",
          output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }],
        }),
    });
    await expect(
      refusal.generateStructured({
        model: "gpt-5.6-terra",
        schemaName: "test",
        schema: {},
        instructions: "test",
        data: {},
        reasoningEffort: "low",
      }),
    ).rejects.toMatchObject({ code: "NO_VALID_CANDIDATES" });
    const throttled = new OpenAiResponsesProvider({
      apiKey: "test",
      fetcher: async () => new Response(null, { status: 429 }),
    });
    await expect(
      throttled.generateStructured({
        model: "gpt-5.6-terra",
        schemaName: "test",
        schema: {},
        instructions: "test",
        data: {},
        reasoningEffort: "low",
      }),
    ).rejects.toMatchObject({ code: "QUESTION_GENERATION_RATE_LIMITED" });
  });
});

describe("question intelligence validation", () => {
  it("builds a schema-valid MULTIPLE_CHOICE candidate and signs its receipt", async () => {
    const model: AiModelProvider = {
      generateStructured: async <T>() => ({
        value: {
          proposals: [
            {
              ...baseProposal,
              type: "MULTIPLE_CHOICE",
              payload: {
                prompt: "Theo Giăng 3:16, những điều nào được nói đến? Chọn mọi đáp án đúng.",
                options: ["Đức Chúa Trời yêu thế gian", "Ngài ban Con Một", "Nô-ê đóng tàu"],
                correctOptionIndexes: [0, 1],
              },
            },
          ],
        } as unknown as T,
        model: "gpt-5.6-terra",
        responseId: "resp_test",
        latencyMs: 5,
      }),
    };
    const service = new QuestionIntelligenceService({
      provider: model,
      scripture: new ScriptureService(scriptureProvider),
      model: "gpt-5.6-terra",
      provenanceSigningKey: "test-signing-key-at-least-32-characters",
    });
    const result = await service.generate({
      scriptureScope: { provider: "youversion", bibleVersionId: 449, passageId: "JHN.3.16-18" },
      count: 1,
      types: ["MULTIPLE_CHOICE"],
      difficulty: "MEDIUM",
      audience: "YOUTH",
      locale: "vi",
      existingItems: [],
      clientGenerationId: "018f89b5-d3e1-7c63-b0f1-32ae54b0fc90",
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].proposedItem).toMatchObject({
      type: "MULTIPLE_CHOICE",
      correctOptionIds: ["option_1", "option_2"],
    });
    expect(result.candidates[0].validationReceipt).toMatch(/^v1\./u);
    const candidate = result.candidates[0];
    const now = new Date().toISOString();
    const approved = {
      title: "AI game",
      mode: "TURN_BASED" as const,
      defaultDurationSec: 20,
      createdClientVersion: "test",
      items: [
        {
          ...candidate.proposedItem,
          generationProvenance: {
            source: "AI_ASSISTED" as const,
            provider: "openai" as const,
            model: candidate.generation.model,
            promptVersion: candidate.generation.promptVersion,
            strategyVersion: candidate.generation.strategyVersion,
            generatedAt: candidate.generation.generatedAt,
            validatedAt: now,
            humanApprovedAt: now,
            confidence: candidate.confidence,
            validationReceipt: candidate.validationReceipt,
          },
        },
      ],
    };
    const verified = await sanitizeGenerationProvenance(
      approved,
      "test-signing-key-at-least-32-characters",
    );
    expect(verified.items[0].generationProvenance).toBeDefined();
    approved.items[0].generationProvenance.validationReceipt = "v1.forged";
    const downgraded = await sanitizeGenerationProvenance(
      approved,
      "test-signing-key-at-least-32-characters",
    );
    expect(downgraded.items[0].generationProvenance).toBeUndefined();
  });

  it("rejects invented excerpts before a candidate can reach the builder", async () => {
    const model: AiModelProvider = {
      generateStructured: async <T>() => ({
        value: {
          proposals: [
            {
              ...baseProposal,
              evidence: [
                {
                  passageId: "JHN.3.16",
                  supportingExcerpt: "một câu không tồn tại trong phân đoạn",
                  claimSupported: "Sai",
                },
              ],
              type: "SHORT_ANSWER",
              payload: {
                prompt: "Ai yêu thương thế gian?",
                canonicalAnswer: "Đức Chúa Trời",
                acceptedAliases: [],
              },
            },
          ],
        } as unknown as T,
        model: "gpt-5.6-terra",
        latencyMs: 5,
      }),
    };
    const service = new QuestionIntelligenceService({
      provider: model,
      scripture: new ScriptureService(scriptureProvider),
      model: "gpt-5.6-terra",
    });
    await expect(
      service.generate({
        scriptureScope: { provider: "youversion", bibleVersionId: 449, passageId: "JHN.3.16-18" },
        count: 1,
        types: ["SHORT_ANSWER"],
        difficulty: "EASY",
        audience: "YOUTH",
        locale: "vi",
        existingItems: [],
        clientGenerationId: "018f89b5-d3e1-7c63-b0f1-32ae54b0fc90",
      }),
    ).rejects.toMatchObject({ code: "NO_VALID_CANDIDATES" });
  });

  it("rejects a high-risk candidate when the independent evidence-only review fails", async () => {
    const calls: string[] = [];
    const model: AiModelProvider = {
      generateStructured: async <T>(input: { schemaName: string }) => {
        calls.push(input.schemaName);
        if (input.schemaName === "question_candidate_review_v1") {
          return {
            value: {
              reviews: [
                {
                  candidateIndex: 0,
                  verdict: "FAIL",
                  reasons: ["Một lựa chọn đúng khác có thể bị bỏ sót."],
                },
              ],
            } as T,
            model: "gpt-5.6-sol",
            latencyMs: 5,
          };
        }
        return {
          value: {
            proposals: [
              {
                ...baseProposal,
                type: "MULTIPLE_CHOICE",
                payload: {
                  prompt: "Theo Giăng 3:16, hãy chọn mọi đáp án đúng.",
                  options: ["Yêu thế gian", "Ban Con Một", "Không đoán xét"],
                  correctOptionIndexes: [0, 1],
                },
              },
            ],
          } as T,
          model: "gpt-5.6-terra",
          latencyMs: 5,
        };
      },
    };
    const service = new QuestionIntelligenceService({
      provider: model,
      scripture: new ScriptureService(scriptureProvider),
      model: "gpt-5.6-terra",
      reviewModel: "gpt-5.6-sol",
    });
    await expect(
      service.generate({
        scriptureScope: { provider: "youversion", bibleVersionId: 449, passageId: "JHN.3.16-18" },
        count: 1,
        types: ["MULTIPLE_CHOICE"],
        difficulty: "MEDIUM",
        audience: "YOUTH",
        locale: "vi",
        existingItems: [],
        clientGenerationId: "018f89b5-d3e1-7c63-b0f1-32ae54b0fc90",
      }),
    ).rejects.toMatchObject({ code: "NO_VALID_CANDIDATES" });
    expect(calls).toEqual([
      "question_candidate_batch_v1",
      "question_candidate_review_v1",
      "question_candidate_batch_v1",
      "question_candidate_review_v1",
      "question_candidate_batch_v1",
      "question_candidate_review_v1",
    ]);
  });

  it("performs at most two targeted refills when deterministic validation rejects a proposal", async () => {
    let calls = 0;
    const model: AiModelProvider = {
      generateStructured: async <T>() => {
        calls += 1;
        return {
          value: {
            proposals: [
              {
                ...baseProposal,
                proposedDifficulty: { label: "EASY", featureReasons: ["Đáp án hiện rõ."] },
                evidence: [
                  {
                    passageId: "JHN.3.16",
                    supportingExcerpt:
                      calls === 1
                        ? "một trích đoạn không tồn tại"
                        : "Đức Chúa Trời yêu thương thế gian",
                    claimSupported: "Đức Chúa Trời yêu thương thế gian.",
                  },
                ],
                type: "SHORT_ANSWER",
                payload: {
                  prompt: "Ai yêu thương thế gian?",
                  canonicalAnswer: "Đức Chúa Trời",
                  acceptedAliases: [],
                },
              },
            ],
          } as T,
          model: "gpt-5.6-terra",
          latencyMs: 5,
        };
      },
    };
    const result = await new QuestionIntelligenceService({
      provider: model,
      scripture: new ScriptureService(scriptureProvider),
      model: "gpt-5.6-terra",
    }).generate({
      scriptureScope: { provider: "youversion", bibleVersionId: 449, passageId: "JHN.3.16-18" },
      count: 1,
      types: ["SHORT_ANSWER"],
      difficulty: "EASY",
      audience: "YOUTH",
      locale: "vi",
      existingItems: [],
      clientGenerationId: "018f89b5-d3e1-7c63-b0f1-32ae54b0fc90",
    });
    expect(calls).toBe(2);
    expect(result.candidates).toHaveLength(1);
  });
});

describe("deterministic Auto Balance", () => {
  it("respects crossword/round budgets and produces a 40/40/20 mixed difficulty target", () => {
    const existing = Array.from({ length: 10 }, (_, index) => ({
      type: "SHORT_ANSWER" as const,
      normalizedAnswer: "Đa-vít",
      passageId: "JHN.3.16",
      runtimeRoundCost: index < 5 ? 10 : 9,
    }));
    const selected = selectBalancedTypes(existing, 5);
    expect(selected).not.toContain("CROSSWORD");
    expect(selected[0]).not.toBe("SHORT_ANSWER");
    expect(targetDifficulties("MIXED", 10)).toEqual([
      "EASY",
      "EASY",
      "EASY",
      "EASY",
      "MEDIUM",
      "MEDIUM",
      "MEDIUM",
      "MEDIUM",
      "HARD",
      "HARD",
    ]);
    expect(draftRecommendations(existing).join(" ")).toMatch(/đáp án bị lặp|10\/10/u);
  });
});
