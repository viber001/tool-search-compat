# OpenCode `tool_search` Compatibility

This plugin provides a small compatibility shim for providers that inject the Codex `tool_search` contract.

The plugin keeps an internal OpenCode tool named `tool_search`, then rewrites that one tool in
OpenAI Responses requests to the native client-side `tool_search` type.
OpenCode already exposes permitted tools directly, so the shim returns `{ "tools": [] }` and does not
search or dynamically load tools.

The request rewrite is implemented through OpenCode's plugin `config` hook by wrapping the in-memory
provider fetch function. It does not modify provider configuration files or any external proxy.

The plugin also appends `No tool_search. Use listed tools only.` through
OpenCode's `experimental.chat.system.transform` hook on every request.

## Installation

Add the plugin's absolute `index.ts` path to the global OpenCode `plugin` list.

```json
{
  "plugin": [
    "file:///absolute/path/to/tool-search-compat/index.ts"
  ]
}
```
