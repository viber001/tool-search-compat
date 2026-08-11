# OpenCode `tool_search` Compatibility

This plugin provides a small compatibility shim for providers that inject the Codex `tool_search` contract.

OpenCode already exposes permitted tools directly, so the shim does not search or dynamically load tools.
It returns a short instruction to call the matching tool from the current tool list.

## Installation

Add the plugin's absolute `index.ts` path to the global OpenCode `plugin` list.

```json
{
  "plugin": [
    "file:///absolute/path/to/tool-search-compat/index.ts"
  ]
}
```
