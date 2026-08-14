# OpenAI Provider Fork for OpenCode `tool_search` Compatibility

This directory contains a local fork of `@ai-sdk/openai@4.0.37`. It keeps the
upstream provider API and adds a narrow Responses API compatibility layer for
OpenAI-compatible endpoints that inject a client-executed `tool_search_call`
even though OpenCode did not register or request a `tool_search` tool.

The fork is loaded as an OpenCode provider package. It is not an OpenCode
plugin and does not modify OpenCode's global tool registry.

## Current OpenCode Usage

The provider entry must point to the compiled ESM file, not the package
directory:

```json
{
  "provider": {
    "headroom-openai-fork": {
      "name": "headroom-openai-fork",
      "npm": "file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork/dist/index.js",
      "options": {
        "baseURL": "http://127.0.0.1:8787/v1"
      }
    }
  }
}
```

Node ESM does not support importing this local directory directly. A directory
URI can work under Bun but fails in the OpenCode desktop runtime with
`ERR_UNSUPPORTED_DIR_IMPORT`, so use the explicit `dist/index.js` path.

OpenCode stores credentials by provider ID. `headroom-openai-fork` therefore
needs its own credential in `~/.local/share/opencode/auth.json`, even when it
shares an endpoint and API key with another provider.

## Fork-Specific Behavior

### Transparent Pending `tool_search_call` Handling

The initial request uses only the tools supplied by OpenCode. The fork does not
automatically add `openai.tools.toolSearch()` and does not declare a hidden
`tool_search` tool.

If the endpoint nevertheless returns a Responses API `tool_search_call` without
a matching `tool_search_output` in the same response, the provider:

1. Builds a matching `tool_search_output` with `status: "completed"` and
   `tools: []`.
2. Appends the replayable output from that response and the no-op output to an
   internal follow-up Responses request when no ordinary `function_call` is
   present.
3. Repeats for at most three total request rounds.
4. Removes the internally completed `tool_search_call` and `tool_search_output`
   items from the final result returned to OpenCode.

If the same response also contains an ordinary `function_call`, the provider
holds the assistant output and function call for OpenCode, sends an internal
follow-up containing only the pending `tool_search_call` and its empty output,
then returns the held output. The ordinary function call is never placed in the
hidden request, so OpenCode can execute it and send the matching
`function_call_output` on the next turn.

This is a protocol compatibility fallback, not real dynamic tool discovery.
The empty catalog is intentional because OpenCode already sent its available
tool definitions in the initial request.

This also handles compatible endpoints that mark an unresolved call as
`execution: "server"`; otherwise OpenCode records that call as an unknown
provider-executed tool. Server calls that already have a matching output, and
explicitly configured `openai.tools.toolSearch()`, remain on the upstream path.

### Reasoning Replay Safety

Reasoning models always request `reasoning.encrypted_content`. During the hidden
follow-up, reasoning output is reconstructed from encrypted content and summary
without replaying server-side `rs_*` item IDs. This avoids compatible endpoints
interpreting those IDs as stale item references.

Normal OpenCode turns also avoid assistant-message and reasoning item-reference
serialization. The configured compatibility endpoint does not reliably retain
those response items across turns, even when the request uses `store: true`, so
the fork sends replayable content instead of relying on `msg_*` or `rs_*` IDs.

Recognized `tool_search` history keeps the stock item-reference behavior. The
fork only omits a provider-executed `tsc_*` item when OpenCode recorded it as an
unknown tool and retained no protocol fields from which the call or output can
be reconstructed safely.

### Explicit `store: true`

Responses requests send `store: true` when the parsed provider option `store`
is omitted:

```ts
const store = openaiOptions?.store ?? true;
```

Some compatible endpoints interpret an omitted field as `false`. Sending the
default explicitly prevents request conversion and endpoint persistence from
using conflicting assumptions. An explicit `store: false` remains `false`.

The fork first reads the standard `providerOptions.openai` namespace. If it is
absent, it also reads the namespace derived from the configured provider name,
such as `providerOptions['headroom-openai-fork']`. The same complete Responses
options schema is used for both namespaces, including `store`,
`reasoningEffort`, `reasoningSummary`, `promptCacheKey`, `textVerbosity`, and
`include`.

### Function Tool Name Mapping

Function tools are serialized with the provider tool-name mapping:

```ts
toolNameMapping?.toProviderToolName(tool.name) ?? tool.name
```

This keeps request tool names aligned with the names used when mapping returned
function calls back to OpenCode. It is a general Responses tool change, not
limited to `tool_search`.

### Buffered Responses Streaming

`doStream()` currently calls `doGenerate()` and converts the completed result
into a buffered AI SDK stream. Responses requests therefore do not use the
upstream native SSE path in this fork.

Consequences include:

- no incremental model output while the upstream response is still running;
- time-to-first-output includes the complete generation and any hidden
  `tool_search` follow-up rounds;
- chunk boundaries and cancellation behavior differ from stock
  `@ai-sdk/openai` Responses streaming.

This tradeoff ensures the provider can consume a pending `tool_search_call`
before exposing a stream to OpenCode.

## What Remains Upstream-Compatible

The public provider still exports `createOpenAI`, `openai`, Responses, chat,
completion, embedding, image, transcription, speech translation, speech,
realtime, files, skills, batch support, and the standard OpenAI provider tools.

The fork-specific source changes are concentrated in:

- `src/responses/convert-to-openai-responses-input.ts`
- `src/responses/openai-responses-language-model.ts`
- `src/responses/openai-responses-prepare-tools.ts`

Do not describe the fork as fully behavior-identical to stock
`@ai-sdk/openai@4.0.37`. Responses request serialization, follow-up request
count, cross-turn item replay, latency, token use, and streaming semantics can
differ as documented above.

## Diagnostics

Set the following environment variable before starting OpenCode to log a compact
summary of each compatibility request round:

```bash
OPENAI_TOOL_SEARCH_COMPAT_DEBUG=1
```

The log includes the compatibility request number, round, `store`,
`previous_response_id`, and input item types/IDs. It intentionally does not log
full prompts or tool arguments.

If an endpoint reports that a `msg_*`, `rs_*`, or `tsc_*` item was not found,
verify the request body at the proxy boundary and check:

- whether `store` is `true` or was explicitly configured as `false`;
- whether the proxy rewrites or ignores `store`;
- whether reasoning follow-up input contains `encrypted_content` without a
  server-side `id` or `item_reference`;
- whether OpenCode is loading this fork's `dist/index.js` rather than stock
  `@ai-sdk/openai`.

## Build and Verify

Node.js 22 or newer is required.

```bash
cd ~/.config/opencode/tool-search-compat/openai-fork
npm install --ignore-scripts
npx tsc --noEmit -p tsconfig.build.json
npx tsup src/index.ts src/internal/index.ts --format esm --dts --out-dir dist \
  --tsconfig tsconfig.build.json \
  --external @ai-sdk/provider --external @ai-sdk/provider-utils --external zod \
  --clean
```

`dist/` is the runtime package loaded by OpenCode and must be rebuilt after
source changes. OpenCode configuration and provider modules are loaded at
startup, so fully quit and restart OpenCode after changing the provider entry or
rebuilding the fork.

See `../docs/2026-08-12-openai-fork-diff.md` for the detailed source comparison
and `../docs/2026-08-12-node-bun-provider-entry.md` for the desktop provider-entry
failure analysis.
