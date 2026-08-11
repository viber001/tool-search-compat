import { type Plugin, tool } from "@opencode-ai/plugin"

const directToolsMessage =
  "OpenCode already exposes permitted tools directly. Call the matching current tool; do not call tool_search again."

export const CodexToolSearchCompat: Plugin = async () => ({
  tool: {
    tool_search: tool({
      description: "Compatibility shim for Codex tool_search. OpenCode exposes tools directly.",
      args: {
        query: tool.schema.string().optional(),
      },
      async execute() {
        return directToolsMessage
      },
    }),
  },
})
