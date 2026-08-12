# openai-fork 与 `@ai-sdk/openai` 差异记录

## 对比基线

- fork：`/Users/galaxy/.config/opencode/tool-search-compat/openai-fork`
- 上游包：`@ai-sdk/openai@4.0.37`
- 上游源码快照：`/var/folders/rv/8m9kmnws229_62m4d4bw16jc0000gn/T/opencode/package`
- 对比命令：`diff -qr <upstream>/src <fork>/src`
- 结论范围：源码静态对比、TypeScript 检查和构建验证；不是完整 API 兼容性测试。

## 源码改动范围

与上游 `src/` 相比，只有两个源码文件不同：

- `openai-fork/src/responses/openai-responses-language-model.ts`
- `openai-fork/src/responses/openai-responses-prepare-tools.ts`

其余 Responses 文件、其他工具实现、配置和 provider API 文件均与 `@ai-sdk/openai@4.0.37` 的源码一致。`src/tool/tool-search.ts` 本身没有相对上游的改动，上游版本已经包含 `tool_search` 的类型和 schema；fork 改的是兼容执行流程。

## 具体修改

### 1. 自动注入 Codex client-side `tool_search`

文件：`openai-fork/src/responses/openai-responses-language-model.ts:84-155`

- 定义 provider tool `openai.tool_search`，名称为 `tool_search`，执行方式为 `client`。
- 请求参数为 `{ query: string }`。
- 当请求没有 `openai.tool_search` 时自动追加该 provider tool。
- 当输入中存在普通 function `tool_search` 时将其过滤，避免和 OpenAI 保留的 `tool_search` namespace 冲突。
- 对 Responses API 返回的 client-side `tool_search_call` 构造 `tool_search_output`，但固定返回 `tools: []`。OpenCode 生成的工具描述已经在初始 Responses 请求的 `tools` 数组中发送给模型，不再重复作为动态加载结果返回。
- 最多自动完成 3 轮 Responses 请求。

这部分是 fork 的主要兼容目标。

### 2. Responses 请求的工具名映射

文件：`openai-fork/src/responses/openai-responses-prepare-tools.ts:106-110,423-447`

普通 function tool 在发给 Responses API 前使用：

```ts
toolNameMapping?.toProviderToolName(tool.name) ?? tool.name
```

上游这里直接使用 `tool.name`。这不是 `tool_search` 专属修改，会影响需要 provider/custom tool name mapping 的普通 function tool。

### 3. 启用自动 `tool_search` 时强制 `store: true`

文件：`openai-fork/src/responses/openai-responses-language-model.ts:403-427`

fork 使用：

```ts
const store = hasCodexToolSearch ? true : openaiOptions?.store;
```

原因是 Codex-compatible endpoint 的下一轮请求会复用上一轮 response item；服务端要求这些 item 持久化。该行为会改变请求的存储语义：即使调用方设置 `store: false`，自动兼容 `tool_search` 时也会发送 `store: true`。

### 4. `doGenerate` 增加多轮 client tool search 流程

文件：`openai-fork/src/responses/openai-responses-language-model.ts:709-800`

上游单次请求后直接解析结果；fork 会在返回 client-side `tool_search_call` 时：

1. 将上一轮 `response.output` 追加到下一轮 input。
2. 追加 `tool_search_output`，其中 `tools` 固定为空数组，不加载额外工具。
3. 最多重复 3 轮。

这会改变请求次数、延迟、token 消耗和最终 request body，属于有意的兼容行为差异。

### 5. `doStream` 改为先完整生成，再返回 buffered stream

文件：`openai-fork/src/responses/openai-responses-language-model.ts:1417-1426`

fork 的 `doStream` 当前执行：

```ts
const generated = await this.doGenerate(options);
return {
  stream: createBufferedLanguageModelStream(generated),
  request: generated.request,
  response: generated.response,
};
```

上游使用原生 Responses SSE 流。因而 fork 的所有 Responses 流式请求都会先等待完整响应，之后再生成兼容流；流式首字节延迟、分块粒度、中途取消和实时输出行为都可能不同。这是目前最重要的非 `tool_search` 行为差异。

## 未修改和已验证一致的部分

- 除上述两个文件外，fork 的 `src/` 与上游 `@ai-sdk/openai@4.0.37` 一致。
- `src/tool/tool-search.ts` 与上游一致；fork 没有修改 tool search 的类型定义或 schema。
- 其他 provider tool 的准备逻辑、Responses input 转换、错误处理、usage 转换、finish reason 映射等源码没有被 fork 直接修改。
- `openai-responses-batch.ts` 没有 fork 专属源码改动；它复用修改后的 Responses model `getArgs()`，因此启用自动 `tool_search` 时仍会继承 `store` 和工具名映射变化。

已执行验证：

- `npx tsc --noEmit -p openai-fork/tsconfig.build.json`：通过。
- `npx tsup src/index.ts src/internal/index.ts --format esm --dts ...`：构建通过。
- 普通 CLI 请求：通过并返回 `OK`。
- 强制 `tool_search` CLI 请求：通过并返回 `OK`。
- 桌面端会话已由用户确认测试通过。

## 结论

**不能确认“除 `tool_search` 外其他行为完全一致”。**

可以确认的是：fork 的源码改动范围很小，且非上述两个 Responses 文件的源码与 `@ai-sdk/openai@4.0.37` 一致。但 fork 同时改变了：

- 普通 function tool 的 provider name mapping；
- 自动 `tool_search` 场景下的 `store` 语义；
- Responses 请求的轮数、request body、延迟和 token 消耗；
- 所有 Responses `doStream` 的实现方式和流式时序。

因此当前准确表述应是：**fork 保留官方 SDK 的主体实现，并增加 Codex `tool_search` 兼容层；模型仍可读取初始请求中的 OpenCode 工具描述，但不能宣称 Responses 的所有非兼容层行为完全等价。**

## 风险与后续验证边界

曾观察到以下服务端错误，需要单独继续验证：

```text
Item with id 'rs_084759ba2e20986a016a7bd2cf78a4819184bcd783e22ba985' not found. Items are not persisted when `store` is set to false. Try again with `store` set to true, or remove this item from your input.
```

该错误说明 Responses 的 reasoning/item 持久化链仍可能受 `previous_response_id`、batch model 或已有会话历史影响。当前文档只记录已知风险，不把普通请求通过等同于完整兼容性验证。
