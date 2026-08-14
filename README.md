# OpenCode `tool_search` Compatibility

This repository contains a local fork of `@ai-sdk/openai@4.0.37` for providers that inject the Codex
`tool_search` prompt. The compatibility logic is implemented in the provider fork, not as a global
OpenCode plugin, so providers using the stock SDK are unaffected.

In the current OpenCode configuration, `headroom-photonmark` and `headroom-openai-fork` use the same
`http://127.0.0.1:8787/v1` endpoint. Their configuration-level difference is the `npm` entry:
`headroom-photonmark` uses `@ai-sdk/openai`, while `headroom-openai-fork` uses this compiled fork.
That package difference is behaviorally significant because it changes the JSON sent to the same
proxy; it is not a second proxy or a different upstream endpoint.

The fork does not modify OpenCode's tool registry and does not add a plugin. It recognizes
`tool_search_call` directly in the Responses API response path. When a call has no matching
`tool_search_output` in the same response, the provider creates one with `tools: []`, continues the
internal Responses request, and consumes the protocol item. This covers compatible endpoints that
label an unresolved call as either client- or server-executed. OpenCode therefore receives neither
an OpenAI-specific pending `tool_search_call` nor an unknown tool call.

Before appending the pending `tool_search_call` and its empty output, the hidden request converts
assistant-visible message, reasoning, and compaction output back through the same
`convertToOpenAIResponsesInput()` path used for normal OpenCode prompts. The stable prefix therefore
uses the same canonical wire representation that OpenCode produces on the next turn instead of raw
Responses output items.

When the same response also contains an ordinary `function_call`, that call is excluded from the
hidden request. The provider holds the canonicalized assistant output and ordinary function call until
the hidden request completes, then returns them to OpenCode for normal tool execution. This prevents a
hidden request from sending a `function_call` before OpenCode can produce its matching
`function_call_output`. Pure tool-search rounds also retain their assistant-visible output in the final
provider result so the next OpenCode request can reuse the same canonical prefix.

The normal OpenCode instruction remains `No tool_search. Use listed tools only.` Explicit upstream
`openai.tools.toolSearch()` provider tools remain available when a caller intentionally opts in.

Responses requests also preserve the OpenAI default `store: true` explicitly on the wire. This matters
for compatible endpoints that interpret an omitted `store` field as `false`; without it, later requests
may reference response items that the endpoint did not persist. Callers can still opt out with
`providerOptions.openai.store: false`; the fork preserves that explicit value. The hidden no-op
compatibility flow canonicalizes replayable assistant output and appends it to its internal follow-up
request without requiring `tool_search` in the initial request. Reasoning models always request encrypted
content, and reasoning replay uses that content instead of an `rs_* item_reference`.

OpenCode can namespace provider options by the configured provider ID when it dynamically loads the
local file package. The fork retains `providerOptions.openai` compatibility and falls back to the
configured namespace, such as `providerOptions['headroom-openai-fork']`, using the complete OpenAI
Responses options schema. Model variants therefore propagate options such as `reasoningEffort`,
`store`, `promptCacheKey`, `textVerbosity`, and `include` to the HTTP request.

The stock SDK and this fork therefore do not produce identical request bodies when `store` is omitted:
the stock SDK may omit the field, while the fork sends `store: true`. If `headroom-photonmark` works
without the error while the fork reports an `rs_... not found` item, that only shows that the two request
shapes took different paths through the proxy/upstream; it does not show that the providers use different
proxy addresses. Capture the request body at `127.0.0.1:8787` to distinguish an explicit `store: false`
from a downstream rewrite or interpretation.

## OpenCode Configuration

The provider definition is configured in `~/.config/opencode/opencode.jsonc`.
Authentication credentials are stored in `~/.local/share/opencode/auth.json`;
add a credential for the same provider ID there as well.

Keep existing providers on `@ai-sdk/openai` and add a separate provider using the local fork:

```json
{
  "provider": {
    "headroom-openai-fork": {
      "name": "headroom-openai-fork",
      "npm": "file:///absolute/path/to/tool-search-compat/openai-fork/dist/index.js",
      "options": { "baseURL": "http://127.0.0.1:8787/v1" }
    }
  }
}
```

Do not add the fork entry as a global plugin. OpenCode stores API credentials by provider ID, so the
new provider needs its own API key/auth entry in `~/.local/share/opencode/auth.json`, even when it uses
the same endpoint.

### Tool-search branching variant

`openai-fork-tool-search-branching/` is an alternate build for the real-API-tested mixed path:

```text
A tool_search_call(C) B function_call(E)
        ↓
A B function_call(E) function_call_output(E)
```

When a response contains both a pending tool-search call and an ordinary function call, this variant
returns A/B and the function call directly to OpenCode. It does not send the base fork's hidden
`tool_search_call + tool_search_output` request. Pure pending tool-search responses still use the hidden
follow-up.

Switch by using a separate provider entry:

```json
{
  "provider": {
    "headroom-openai-branching": {
      "name": "headroom-openai-branching",
      "npm": "file:///absolute/path/to/tool-search-compat/openai-fork-tool-search-branching/dist/index.js",
      "options": { "baseURL": "http://127.0.0.1:8787/v1" }
    }
  }
}
```

The real `gpt-5.6-luna` protocol experiment and its stateless-history boundary are documented in
[`docs/2026-08-14-tool-search-branching.md`](./docs/2026-08-14-tool-search-branching.md).

## Build

```bash
cd ~/.config/opencode/tool-search-compat/openai-fork
npm install --ignore-scripts
npx tsup src/index.ts src/internal/index.ts --format esm --dts --out-dir dist \
  --tsconfig tsconfig.build.json \
  --external @ai-sdk/provider --external @ai-sdk/provider-utils --external zod \
  --clean
```

`dist/` is intentionally committed rather than ignored because OpenCode loads
the compiled package entry points (`dist/index.js` and `dist/index.d.ts`). The
`--clean` flag removes stale hashed chunks from previous builds.
`node_modules/` is ignored; run the build after a fresh checkout before using
the local provider.
