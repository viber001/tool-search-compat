// opencode.jsonnet
// jsonnet opencode.jsonnet | jq -S '.provider[].models |= with_entries(.value.cost |= with_entries(.value |= tonumber))' > opencode.jsonc

/*
jsonnet opencode.jsonnet | jq -S '
  .provider[].models |=
    with_entries(
      .value.cost |= with_entries(.value |= tonumber)
    )
' > opencode.jsonc
*/

local variants(max=false) = {
  none: { disabled: true },
  low: { reasoningEffort: "low" },
  medium: { reasoningEffort: "medium" },
  high: { reasoningEffort: "high" },
  xhigh: { reasoningEffort: "xhigh" },
} + if max then {
  max: { reasoningEffort: "max" },
} else {};

local model(
  name,
  input,
  cacheRead,
  cacheWrite,
  output,
  //context=500000,
  context=625000,
  outputLimit=128000,
  maxReasoning=true,
) = {
  name: name,
  reasoning: true,
  temperature: false,
  tool_call: true,
  attachment: true,

  limit: {
    context: context,
    output: outputLimit,
  },

  modalities: {
    input: ["text", "image", "pdf"],
    output: ["text"],
  },

  cost: {
    input: input,
    cache_read: cacheRead,
    cache_write: cacheWrite,
    output: output,
  },

  variants: variants(maxReasoning),
};

// PhotonMark policy:
// cache write tokens are tracked for audit only and are never billed.
local models = {
  "OpenAI/gpt-5.3-codex-spark":
    model(
      "gpt-5.3-codex-spark",
      "0.05",
      "0.005",
      "0",
      "0.3",
      context=128000,
      outputLimit=32768,
      maxReasoning=false,
    ),

  "gpt-5.6-sol":
    model(
      "gpt-5.6-sol",
      "0.5",
      "0.05",
      "0",
      "3.0",
    ),

  "gpt-5.6-terra":
    model(
      "gpt-5.6-terra",
      "0.2",
      "0.02",
      "0",
      "1.2",
    ),

  "gpt-5.6-luna":
    model(
      "gpt-5.6-luna",
      "0.02",
      "0.002",
      "0",
      "0.12",
    ),
};

// Prices are recorded exactly as supplied, without currency conversion.
//
// Reasoning support, verified 2026-08-24 against vendor docs:
// - GLM-5.3: thinking always on; reasoning_effort low/high/max, default max
//   (docs.bigmodel.cn/cn/guide/models/text/glm-5.3).
// - DeepSeek-V4-Pro-0813 / DeepSeek-V4-Flash-0731: thinking on by default;
//   low/high/max, default high; non-thinking mode available
//   (api-docs.deepseek.com/quick_start/pricing).
// - Qwen3.8-Max: hybrid thinking; enable_thinking on/off, default on; effort
//   control only via the Responses API reasoning.effort
//   (help.aliyun.com/zh/model-studio/deep-thinking).
// - Kimi-K3: thinking always on; reasoning_effort low/high/max, default max
//   (platform.kimi.com/docs/guide/use-reasoning-effort).
// None support medium/xhigh, so those variants are omitted.
local parateraVariants(canDisable=false) =
  {
    low: { reasoningEffort: "low" },
    high: { reasoningEffort: "high" },
    max: { reasoningEffort: "max" },
  } + (if canDisable then {
    // Best-effort non-thinking variant; chat completions has no standard
    // thinking off-switch, so the backend default (thinking on) may still apply.
    none: { reasoning: false },
  } else {
    none: { disabled: true },
  });

local parateraModel(name, input, cacheRead, cacheWrite, output, canDisable=false) = {
  name: name,
  reasoning: true,

  limit: {
    context: 1000000,
    output: 128000,
  },

  cost: {
    input: input,
    cache_read: cacheRead,
    cache_write: cacheWrite,
    output: output,
  },

  variants: parateraVariants(canDisable),
};

local parateraModels = {
  "GLM-5.3":
    parateraModel("GLM-5.3", "8.00", "2.00", "28.00", "28.00"),

  "DeepSeek-V4-Pro-0813":
    parateraModel("DeepSeek-V4-Pro-0813", "9.00", "0.30", "27.00", "27.00", true),

  "DeepSeek-V4-Flash-0731":
    parateraModel("DeepSeek-V4-Flash-0731", "3.00", "0.10", "9.00", "9.00", true),

  "Qwen3.8-Max":
    parateraModel("Qwen3.8-Max", "12.00", "1.50", "36.00", "36.00", true),

  "Kimi-K3":
    parateraModel("Kimi-K3", "20.00", "2.00", "100.00", "100.00"),
};

// SiliconFlow (China) models for the local headroom proxy. Five models:
// user-mandated DeepSeek-V4-Flash / DeepSeek-V4-Pro / GLM-5.2 /
// Kimi-K2.7-Code, plus Qwen3.5-397B-A17B. Kimi-K2.7-Code is served by the
// live API but missing from the registry cache, so its specs come from the
// SiliconFlow model page. The full 47-model registry set is archived in
// config/siliconflow-cn.md. Costs are USD list prices (models.dev or
// SiliconFlow), recorded as published, no currency conversion.
local siliconflowModels = {
  "moonshotai/Kimi-K2.7-Code": {
    name: "moonshotai/Kimi-K2.7-Code",
    // Served on siliconflow but absent from the models.dev registry cache;
    // specs from https://www.siliconflow.com/zh-tw/models/kimi-k2-7-code
    // (2026-08-24): no reasoning, tools + image input, 262K context/output,
    // $0.85916 in / $0.17993 cache hit / $3.8 out per M tokens.
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 262144 },
    cost: { input: "0.85916", cache_read: "0.17993", output: "3.8" },
  },
  "zai-org/GLM-5.2": {
    name: "GLM-5.2",
    reasoning: true,
    tool_call: true,
    limit: { context: 1049000, output: 262000 },
    cost: { input: "1.4", cache_read: "0.26", cache_write: "0", output: "4.4" },
  },
  "deepseek-ai/DeepSeek-V4-Pro": {
    name: "deepseek-ai/DeepSeek-V4-Pro",
    reasoning: true,
    tool_call: true,
    limit: { context: 1049000, output: 393000 },
    cost: { input: "1.74", cache_read: "0.145", output: "3.48" },
  },
  "deepseek-ai/DeepSeek-V4-Flash": {
    name: "DeepSeek V4 Flash",
    reasoning: true,
    tool_call: true,
    limit: { context: 1000000, output: 384000 },
    cost: { input: "0.14", cache_read: "0.003", output: "0.28" },
  },
  "Qwen/Qwen3.5-397B-A17B": {
    name: "Qwen/Qwen3.5-397B-A17B",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0.29", output: "1.74" },
  },
};

local provider(displayName, baseURL, npm, providerModels=models) = {
  name: displayName,
  npm: npm,

  options: {
    baseURL: baseURL,
  },

  models: providerModels,
};

{
  "$schema": "https://opencode.ai/config.json",

  disabled_providers: [],

  "instructions": [
    "No tool_search. Use listed tools only."
  ],

  lsp: {
    clangd: {
      command: [
        "/opt/homebrew/opt/llvm/bin/clangd",
      ],
      extensions: [
        ".c", ".cpp", ".cc", ".cxx", ".c++",
        ".h", ".hpp", ".hh", ".hxx", ".h++",
      ],
    },
    fortls: {
      command: [
        "/opt/homebrew/bin/fortls",
      ],
      extensions: [
        ".f", ".for", ".f77", ".f90", ".f95", ".f03", ".f08", ".f18",
        ".F", ".FOR", ".F77", ".F90", ".F95", ".F03", ".F08", ".F18",
      ],
    },
  },

  provider: {
    photonmark:
      provider(
        "photonmark-codex-pay",
        "https://codex.photonmark.com/openai/v1",
        "@ai-sdk/openai",
      ),

    paratera:
      provider(
        "paratera",
        "https://llmapi.paratera.com/v1",
        "@ai-sdk/openai-compatible",
        parateraModels,
      ),

    // @ai-sdk/openai-compatible appends /chat/completions to this base URL.
    "paratera-headroom":
      provider(
        "paratera-headroom",
        "http://10.68.247.14:8787/v1",
        "@ai-sdk/openai-compatible",
        parateraModels,
      ),

    // Local headroom proxy in front of SiliconFlow (China), upstream
    // https://api.siliconflow.cn/v1 (built-in `siliconflow-cn` provider).
    "siliconflow-headroom":
      provider(
        "siliconflow-headroom",
        "http://10.68.247.14:8788/v1",
        "@ai-sdk/openai-compatible",
        siliconflowModels,
      ),

    headroom:
      provider(
        "headroom-photonmark",
        "http://127.0.0.1:8787/v1",
        "@ai-sdk/openai",
      ),

    "headroom-openai-fork0":
      provider(
        "headroom-openai-fork0",
        "http://127.0.0.1:8787/v1",
        "file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork/dist/index.js",
      ) + {
        options+: {
          setCacheKey: true,
        },
      },
    "headroom-openai-fork":
      provider(
        "headroom-openai-fork",
        "http://127.0.0.1:8787/v1",
        "file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/dist/index.js",
      ) + {
        options+: {
          setCacheKey: true,
        },
      },
  },

  shell: "zsh",
}
