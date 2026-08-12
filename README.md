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
`tool_search_call` directly in the Responses API response path. For a client-side call, the provider
creates a matching `tool_search_output` with `tools: []`, continues the internal Responses request,
and consumes the protocol item. OpenCode therefore receives neither an OpenAI-specific
`tool_search_call` nor an unknown tool call.

The normal OpenCode instruction remains `No tool_search. Use listed tools only.` Explicit upstream
`openai.tools.toolSearch()` provider tools remain available when a caller intentionally opts in.

Responses requests also preserve the OpenAI default `store: true` explicitly on the wire. This matters
for compatible endpoints that interpret an omitted `store` field as `false`; without it, later requests
may reference response items that the endpoint did not persist. Callers can still opt out with
`providerOptions.openai.store: false`; the fork preserves that explicit value. The hidden no-op
compatibility flow appends replayable parts of the previous response to its internal follow-up request
and does not require declaring `tool_search` in the initial request. Reasoning models always request
encrypted content, and reasoning parts are replayed without their server-side `rs_*` IDs, so compatible
endpoints do not receive stale reasoning references even when the proxy emits the client-side call later.

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
