import { type Config, type Plugin, tool } from "@opencode-ai/plugin"

const emptyToolSearchResult = { tools: [] }
const noToolSearchInstruction = "No tool_search. Use listed tools only."

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function requestURL(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

function isToolSearchName(name: unknown) {
  return name === "tool_search" || (typeof name === "string" && name.endsWith(".tool_search"))
}

function toolSearchCallID(value: unknown) {
  if (typeof value !== "string" || value.startsWith("tsc_")) return value
  if (value.startsWith("call_")) return `tsc_compat_${value.slice("call_".length)}`
  return value
}

function parseToolSearchOutput(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  }
  return value
}

function rewriteResponsesInput(input: unknown) {
  if (!Array.isArray(input)) return input

  return input.map((item: Record<string, any>) => {
    if (item?.type === "tool_search_call") {
      const callID = toolSearchCallID(item.call_id ?? item.id)
      return { ...item, id: callID, call_id: callID }
    }

    if (item?.type === "function_call_output") {
      const output = parseToolSearchOutput(item.output)
      if (output && Array.isArray(output.tools)) {
        return {
          type: "tool_search_output",
          execution: "client",
          call_id: toolSearchCallID(item.call_id),
          status: "completed",
          tools: output.tools,
        }
      }
    }

    return item
  })
}

function rewriteResponsesRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (!/\/responses(?:[/?]|$)/.test(requestURL(input)) || typeof init?.body !== "string") return init

  try {
    const body = JSON.parse(init.body)
    if (!Array.isArray(body.tools)) return init

    let changed = false
    body.tools = body.tools.map((item: Record<string, any>) => {
      if (item?.type !== "function") return item

      const name = item.name ?? item.function?.name
      if (!isToolSearchName(name)) return item

      changed = true
      return {
        type: "tool_search",
        execution: "client",
        description: item.description ?? item.function?.description,
        parameters: item.parameters ?? item.function?.parameters ?? {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          additionalProperties: false,
        },
      }
    })

    const rewrittenInput = rewriteResponsesInput(body.input)
    if (rewrittenInput !== body.input) {
      body.input = rewrittenInput
      changed = true
    }

    if (!changed) return init

    // Client-side tool search results are sent back in the next request body.
    body.store = false
    return { ...init, body: JSON.stringify(body) }
  } catch {
    return init
  }
}

function wrapFetch(current: unknown): Fetch {
  const base = typeof current === "function" ? (current as Fetch) : fetch
  return (input, init) => {
    const rewritten = rewriteResponsesRequest(input, init)
    if (process.env.OPENCODE_TOOL_SEARCH_COMPAT_DEBUG === "1" && rewritten?.body !== init?.body) {
      console.error(`[tool-search-compat] ${rewritten?.body}`)
    }
    return base(input, rewritten)
  }
}

function installFetchAdapters(config: Config) {
  for (const provider of Object.values(config.provider ?? {})) {
    provider.options ??= {}
    provider.options.fetch = wrapFetch(provider.options.fetch)
  }
}

export const CodexToolSearchCompat: Plugin = async () => ({
  config: installFetchAdapters,
  "experimental.chat.system.transform": async (_input, output) => {
    output.system.push(noToolSearchInstruction)
  },
  tool: {
    tool_search: tool({
      description: "Compatibility shim for Codex tool_search. OpenCode exposes tools directly.",
      args: {
        query: tool.schema.string().optional(),
      },
      async execute() {
        return {
          output: JSON.stringify(emptyToolSearchResult),
        }
      },
    }),
  },
})
