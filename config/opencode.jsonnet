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

local photonmarkVariants(max=false) = {
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
  //context=872000,
  context=1050000,
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

  variants: photonmarkVariants(maxReasoning),
};

// PhotonMark policy:
// cache write tokens are tracked for audit only and are never billed.
local photonmarkModels = {
  "gpt-6-astra":
    model(
      "gpt-6-astra",
      "1",
      "0.1",
      "0",
      "5",
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
};

// TokenHub Token Plan 企业版专业套餐（广州地域，OpenAI 兼容协议）
local tencentVariants(none) = {
  low: { reasoningEffort: "low" },
  high: { reasoningEffort: "high" },
  max: { reasoningEffort: "max" },
} + none;

local noReasoning = { none: { reasoning: false } };
local noNone = { none: { disabled: true } };

local tencentModel(
  name,
  input,
  cacheRead,
  output,
  context=1000000,
  outputLimit=384000,
  variants=tencentVariants(noReasoning),
  modalities=null,
) = {
  name: name,
  reasoning: true,
  tool_call: true,

  limit: {
    context: context,
    output: outputLimit,
  },

  cost: {
    input: input,
    cache_read: cacheRead,
    output: output,
  },

  variants: variants,
} + if modalities != null then { modalities: modalities } else {};

// DeepSeek-V4-Pro 原厂直供三别名同指同一模型（0813 正式版原厂直供）：
//   deepseek-v4-pro-202606      平台主档位 ID（2026-06 版）
//   deepseek/deepseek-v4-pro-0813  原厂命名空间 + 版本号指针
//   deepseek/deepseek-v4-pro    原厂命名空间，跟随官方最新正式版
// 本配置选用 deepseek/deepseek-v4-pro 作为首选。
local tencentModels = {
  "deepseek/deepseek-flash":
    tencentModel(
      "DeepSeek V4.1 Flash (原厂直供)",
      "200.00",
      "4.00",
      "800.00",
      variants=tencentVariants(noReasoning),
    ),

  "deepseek/deepseek-v4-pro":
    tencentModel(
      "DeepSeek V4 Pro (原厂直供)",
      "900.00",
      "30.00",
      "2700.00",
      variants=tencentVariants(noReasoning),
    ),

  "deepseek/deepseek-v4-flash-vision-exp":
    tencentModel(
      "DeepSeek V4 Flash Vision Exp (原厂直供)",
      "200.00",
      "4.00",
      "800.00",
      variants=tencentVariants(noReasoning),
      modalities={ input: ["text", "image"], output: ["text"] },
    ),

  "glm-5.3":
    tencentModel(
      "GLM-5.3",
      "800.00",
      "200.00",
      "2800.00",
      outputLimit=128000,
      variants=tencentVariants(noNone),
    ),

  "glm-5.3-flash":
    tencentModel(
      "GLM-5.3-Flash",
      "80.00",
      "23.00",
      "280.00",
      outputLimit=128000,
      variants=tencentVariants(noNone),
    ),

  "kimi-k3":
    tencentModel(
      "Kimi K3",
      "2000.00",
      "200.00",
      "10000.00",
      outputLimit=128000,
      variants=tencentVariants(noNone),
    ),

  "kimi-k2.7-code":
    tencentModel(
      "Kimi K2.7 Code",
      "650.00",
      "130.00",
      "2700.00",
      context=262144,
      outputLimit=262144,
      variants=tencentVariants(noNone),
    ),

  "kimi-k2.7-code-highspeed":
    tencentModel(
      "Kimi K2.7 Code HighSpeed",
      "1300.00",
      "260.00",
      "5400.00",
      context=262144,
      outputLimit=262144,
      variants=tencentVariants(noNone),
    ),

  "minimax-m3":
    tencentModel(
      "MiniMax M3",
      "210.00",
      "42.00",
      "840.00",
      outputLimit=65536,
      variants=tencentVariants(noReasoning),
    ),

  "minimax-m2.7":
    tencentModel(
      "MiniMax M2.7",
      "210.00",
      "42.00",
      "840.00",
      context=205000,
      outputLimit=65536,
      variants=tencentVariants(noReasoning),
    ),
};

local provider(displayName, baseURL, npm, providerModels=photonmarkModels) = {
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
    "headroom-photonmark":
      provider(
        "headroom-photonmark",
        "http://127.0.0.1:8787/v1",
        "@ai-sdk/openai",
      ),
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

    "tencent-tokenhub":
      provider(
        "tencent-tokenhub",
        "https://tokenhub.tencentmaas.com/plan/v3",
        "@ai-sdk/openai",
        tencentModels,
      ),
    "headroom-tencent-fork":
      provider(
        "headroom-tencent-fork",
        "http://127.0.0.1:8788/v1",
        "file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/dist/index.js",
        tencentModels,
      ) + {
        options+: {
          setCacheKey: true,
          headers: {
            'x-headroom-base-url': 'https://tokenhub.tencentmaas.com',
            'x-headroom-original-path': '/plan/v3/responses',
          },
        },
      },
  },

  shell: "zsh",
}
