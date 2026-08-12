# OpenCode `tool_search` Compatibility

This repository contains a local fork of `@ai-sdk/openai@4.0.37` for providers that inject the Codex
`tool_search` prompt. The compatibility logic is implemented in the provider fork, not as a global
OpenCode plugin, so providers using the stock SDK are unaffected.

OpenCode registers the local no-op handler in
`~/.config/opencode/plugins/tool-search-noop.ts`. Its execution result is `[]`, but the fork does not
expose that function in the Responses API `tools` array. If a proxy-injected prefix still causes the
model to return a native client-side `tool_search_call`, the fork consumes it internally, returns an
empty tool catalog, and continues the request. OpenCode therefore receives `[]` rather than an unknown
tool call.

The configured instruction is `tool_search is no-op. Use listed tools only.` Explicit upstream
`openai.tools.toolSearch()` provider tools remain available when a caller intentionally opts in.

Responses requests also preserve the OpenAI default `store: true` explicitly on the wire. This matters
for compatible endpoints that interpret an omitted `store` field as `false`; without it, later requests
may reference response items that the endpoint did not persist. Callers can still opt out with
`providerOptions.openai.store: false`; the fork preserves that explicit value. The hidden no-op
compatibility flow appends the previous response output to its internal follow-up request and does not
require declaring `tool_search` in the initial request.

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

Do not add the removed `index.ts` as a global plugin. OpenCode stores API credentials by provider ID,
so the new provider needs its own API key/auth entry in `~/.local/share/opencode/auth.json`, even when
it uses the same endpoint.

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
