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

local provider(displayName, baseURL) = {
  name: displayName,
  npm: "@ai-sdk/openai",

  options: {
    baseURL: baseURL,
  },

  models: models,
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
      ),

    headroom:
      provider(
        "headroom-photonmark",
        "http://127.0.0.1:8787/v1",
      ),
  },

  shell: "zsh",
}
