# openai-fork 与 `@ai-sdk/openai` 差异记录

## 对比基线

- fork：`/Users/galaxy/.config/opencode/tool-search-compat/openai-fork`
- 上游包：`@ai-sdk/openai@4.0.37`
- 上游源码快照：`/var/folders/rv/8m9kmnws229_62m4d4bw16jc0000gn/T/opencode/package`
- 对比命令：`diff -qr <upstream>/src <fork>/src`
- 结论范围：源码静态对比、TypeScript 检查和构建验证；不是完整 API 兼容性测试。

## OpenCode 配置层对比

`headroom-photonmark` 与 `headroom-openai-fork` 都使用：

```text
http://127.0.0.1:8787/v1
```

配置层的差异只有 provider 的 `npm` 入口：

```json
"headroom-photonmark": {
  "npm": "@ai-sdk/openai"
}
"headroom-openai-fork": {
  "npm": "file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork/dist/index.js"
}
```

因此，两个 provider 不是在比较两个代理。它们是在比较同一个代理接收到的两种 SDK 请求
序列化结果。`npm` 入口看起来只是一个配置字段，但它决定实际加载的是 stock SDK 还是 fork
实现，进而决定 `store`、`tool_search_call` 和 Responses follow-up 的行为。

## 源码改动范围

与上游 `src/` 相比，当前有三个源码文件不同：

- `openai-fork/src/responses/convert-to-openai-responses-input.ts`
- `openai-fork/src/responses/openai-responses-language-model.ts`
- `openai-fork/src/responses/openai-responses-prepare-tools.ts`

其余 Responses 文件、其他工具实现、配置和 provider API 文件均与 `@ai-sdk/openai@4.0.37` 的源码一致。`src/tool/tool-search.ts` 本身没有相对上游的改动，上游版本已经包含 `tool_search` 的类型和 schema；fork 改的是兼容执行流程和跨轮 input 序列化。

## 具体修改

### 1. 在 provider 内部消费 `tool_search_call`

文件：`openai-fork/src/responses/openai-responses-language-model.ts:83-126,355-419,705-783`

- OpenCode 不注册 `tool_search`，也不新增 plugin；`tool_search_call` 只作为 OpenAI Responses API 协议项由 fork 处理。
- fork 不会自动追加 `openai.tool_search` provider tool，因此初始请求不会声明 `tool_search`。
- fork 识别 Responses API 返回的 `tool_search_call`。对 `execution: "client"` 的调用，直接构造匹配的 `tool_search_output`，固定返回 `tools: []`，并在 provider 内继续请求，不把该协议项交给 OpenCode。
- 最多自动完成 3 轮 Responses 请求。
- 普通 `function_call`、文本和 reasoning 仍按现有 AI SDK 流程返回给 OpenCode。
- 调用方显式提供 `openai.tools.toolSearch()` 时仍按上游方式发送 provider tool。
- 隐藏 follow-up 不再原样回放上一轮的 reasoning output。fork 对 reasoning model 始终请求
  `reasoning.encrypted_content`，并重建不带服务端 `id` 的 reasoning input，避免将 `rs_*`
  标识作为 item reference 送给兼容 endpoint。这样即使初始请求没有声明
  `openai.tool_search`，也能处理代理后置注入的 client-side 调用。

这部分是 fork 的主要兼容目标。

### 2. Responses 请求的工具名映射

文件：`openai-fork/src/responses/openai-responses-prepare-tools.ts:106-110,423-447`

普通 function tool 在发给 Responses API 前使用：

```ts
toolNameMapping?.toProviderToolName(tool.name) ?? tool.name
```

上游这里直接使用 `tool.name`。这不是 `tool_search` 专属修改，会影响需要 provider/custom tool name mapping 的普通 function tool。

### 3. 显式保持 Responses 的 `store: true` 默认值

文件：`openai-fork/src/responses/openai-responses-language-model.ts:372-375`

fork 使用：

```ts
const store = openaiOptions?.store ?? true;
```

上游 stock SDK 的对应代码允许 `store` 在未配置时保持 `undefined`，因此 wire JSON 可能省略该
字段；fork 则将默认值显式发送到请求体。部分兼容 endpoint 会把省略 `store` 解释为 `false`，
但输入转换已经按 `true` 使用历史 response item 的 ID，从而出现：

```text
Item with id 'msg_054a84e0449d8dd3016a7be7e72038819185e648e75597d939' not found. Items are not persisted when `store` is set to false. Try again with `store` set to true, or remove this item from your input.
```

当前 fork 在未配置时请求体发送 `store: true`，调用方明确设置 `store: false` 时则发送 `false`。
这只能保证 fork 到 `127.0.0.1:8787` 这一段的请求体；如果代理或上游之后重写或按 `false` 解释，
fork 本身无法在更下游覆盖该行为。类似的 `rs_... not found` 错误不能单独证明 fork 没有发送
`true`，应直接捕获代理入口的 JSON。provider 内部的 `tool_search_call` 降级流程仍会继续
follow-up request，但会先移除 reasoning output 的服务端 `id`，改用加密内容回放，不要求初始
请求声明该工具。

### 3.1 跨 OpenCode 轮次不复用 assistant message 和 reasoning item reference

文件：

- `openai-fork/src/responses/convert-to-openai-responses-input.ts`
- `openai-fork/src/responses/openai-responses-language-model.ts`

2026-08-12 使用以下新 CLI 会话提示词稳定复现了跨轮失败：

```text
确认~/.config/opencode/tool-search-compat/openai-fork的功能，更新md
```

诊断显示失败发生在新的 provider 调用 `round: 0`，不是隐藏 tool-search follow-up。请求体已经
明确包含 `store: true`，但历史 input 同时包含 `rs_*` 和 `msg_*` 的 `item_reference`，兼容
endpoint 仍返回 404。这证明仅显式发送 `store: true` 不能保证该 endpoint 可以跨 OpenCode
轮次复用已存 item。

fork 因此对正常 OpenCode prompt 转换启用两个独立兼容开关：

- assistant text 不再序列化为 `msg_* item_reference`，而是内联重建 assistant message；
- reasoning 不再序列化为 `rs_* item_reference`，而是使用
  `reasoning.encrypted_content` 和 summary 重建。

`store` 仍保持原有 wire 语义：未配置时发送 `true`，显式 `false` 仍发送 `false`。兼容修复只
避免依赖跨轮 item persistence，不把整次 Responses 请求强制改为 `store: false`。

### 4. `doGenerate` 增加多轮隐藏 client tool search 流程

文件：`openai-fork/src/responses/openai-responses-language-model.ts:749-783`

上游单次请求后直接解析结果；fork 会在代理返回 client-side `tool_search_call` 时：

1. 将上一轮可回放的 `response.output` 追加到下一轮 input；reasoning 只发送
   `encrypted_content` 和 summary，不发送 `rs_*` 服务端 ID。
2. 追加 `tool_search_output`，其中 `tools` 固定为空数组，不加载额外工具。
3. 最多重复 3 轮。

初始请求不需要声明 `tool_search`。这会改变特定响应的请求次数、延迟、token 消耗和最终 request body，属于有意的兼容行为差异。

### 4.1 与旧版 OpenCode no-op 路径的上下文和 prompt cache 差异

历史上的 OpenCode no-op 兼容路径（提交 `8318289` 的 `index.ts`）会把
`tool_search_call` 暴露给 OpenCode。OpenCode 将这个 assistant tool-call 和返回的
`tool_search_output(tools: [])` 写入自己的上下文，下一次调用再通过 prompt 转换把它们发回
Responses API。

当前 fork 的隐藏 follow-up 并不是从 `tool_search_call` 开始截断。它的第二个请求大致仍然是：

```text
初始 input
+ 第一轮 response.output（包含 tool_search_call）
+ tool_search_output(tools: [])
```

`prepareCodexToolSearchFollowUpInput()` 会保留所有非 reasoning output，因此第一轮的
`tool_search_call` 仍然进入隐藏 follow-up。只有 reasoning 会改为不带服务端 `id` 的
`encrypted_content` 形式，以避免将 `rs_*` 解释成不可用的 item reference。

真正的上下文差异发生在隐藏 follow-up 完成以后：

- 旧路径把 client-side `tool_search_call` 和 `tool_search_output` 返回给 OpenCode，后续
  OpenCode 会话历史继续包含它们。
- 当前 fork 在解析最终结果时跳过 client-side `tool_search_call` 和
  `tool_search_output`，所以 OpenCode 后续会话历史不包含这两个中间协议项。

因此，若比较两条路径在后续用户轮次发出的请求，序列会在这些中间项处发生分叉。Prompt
cache 通常按序列化后的 token 前缀匹配；分叉后的后缀不能继续复用旧路径的同一缓存前缀。这里
不能严格表述为“从 `tool_search_call` 的第一个字符开始全部不能命中”：缓存通常按 token 和
缓存块工作，具体边界由 endpoint 决定。

这也不能直接推出 fork 一定更贵：

- 旧路径会发送并保存 `tool_search_call`、`tool_search_output` 等额外上下文；fork 后续请求
  省略这些项，可能减少总输入 token。
- 如果旧路径的较长后缀原本能命中缓存，而 fork 切换到不同前缀，则 fork 可能损失这部分
  cached input 的折扣。
- 连续只使用 fork 时，它可以为自己的稳定前缀重新建立缓存，不是永久性缓存损失。

所以准确结论是：**fork 的隐藏第二请求仍包含 `tool_search_call`；缓存差异主要发生在后续
OpenCode 会话历史是否保留中间协议项，而不是发生在隐藏 follow-up 从该项开始缺内容。是否
亏钱取决于省下的历史 token、失去的 cached input token，以及 endpoint 的缓存规则。应通过
每次响应的 `usage.input_tokens_details.cached_tokens`、`usage.input_tokens` 和
`usage.output_tokens` 对同一模型、同一 prompt cache key 的两条路径做实测比较。**

### 5. `doStream` 改为先完整生成，再返回 buffered stream

文件：`openai-fork/src/responses/openai-responses-language-model.ts:1384-1399`

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

- 除上述三个文件外，fork 的 `src/` 与上游 `@ai-sdk/openai@4.0.37` 一致。
- `src/tool/tool-search.ts` 与上游一致；fork 没有修改 tool search 的类型定义或 schema。
- 其他 provider tool 的准备逻辑、错误处理、usage 转换、finish reason 映射等源码没有被 fork 直接修改。Responses input 转换仅增加上述 assistant-message 和 reasoning item-reference 兼容开关。
- `openai-responses-batch.ts` 没有 fork 专属源码改动；它复用修改后的 Responses model `getArgs()`，因此仍会继承 `store` 和工具名映射变化，也不会自动声明 `tool_search`。

已执行验证：

- `npx tsc --noEmit -p openai-fork/tsconfig.build.json`：通过。
- `npx tsup src/index.ts src/internal/index.ts --format esm --dts ...`：构建通过。
- 普通 CLI 请求：通过并返回 `OK`。
- 代理触发隐藏 `tool_search_call` 的 CLI 请求：通过并返回 `OK`。
- 包含 reasoning、skill 调用、多个文件工具调用和 Markdown 编辑的跨轮 CLI 请求：通过并返回最终答案；诊断中没有 `item_reference`，历史 reasoning 均包含 `encrypted_content`。
- 桌面端会话已由用户确认测试通过。
- stock `@ai-sdk/openai` 与 fork 使用同一代理地址时，fork 的未配置 `store` 请求体显式包含
  `store: true`；stock SDK 的 wire JSON 可能省略该字段。

## 结论

**不能确认“除 `tool_search` 外其他行为完全一致”。**

可以确认的是：fork 的源码改动范围很小，且非上述三个 Responses 文件的源码与 `@ai-sdk/openai@4.0.37` 一致。但 fork 同时改变了：

- 普通 function tool 的 provider name mapping；
- 自动 `tool_search` 场景下的 `store` 语义；
- 正常 OpenCode 轮次的 assistant message 和 reasoning history 序列化；
- Responses 请求的轮数、request body、延迟和 token 消耗；
- 所有 Responses `doStream` 的实现方式和流式时序。

因此当前准确表述应是：**fork 保留官方 SDK 的主体实现，并在 provider 层增加 Responses `tool_search_call` 的透明 no-op 降级；默认请求不声明 `tool_search`，client-side 调用不会暴露给 OpenCode。不能宣称 Responses 的所有非兼容层行为完全等价。**

## 风险与后续验证边界

此前曾观察到以下服务端错误。其典型机制是隐藏 `tool_search` 的第二轮 follow-up 原样带回
reasoning output 的 `rs_*` 服务端 ID，兼容 endpoint 将它解析为不存在的 item reference。后续
实测又确认，即使 fork 明确发送 `store: true`，该 endpoint 仍不能可靠复用正常 OpenCode
历史中的 `msg_*` 和 `rs_*` item。fork 现已同时修复 hidden reasoning 回放、请求体省略 `store`
以及正常跨轮 assistant/reasoning item-reference 序列化问题：

```text
Item with id 'msg_054a84e0449d8dd3016a7be7e72038819185e648e75597d939' not found. Items are not persisted when `store` is set to false. Try again with `store` set to true, or remove this item from your input.
```

如果后续仍出现相同类型的 item 错误，应同时检查：

- fork 发往 `127.0.0.1:8787` 的请求体是否为 `store: true`；
- 第二轮请求的 reasoning input 是否只有 `encrypted_content`，且没有 `id` 或
  `item_reference`；
- 正常后续 provider 调用是否把历史 assistant text 和 reasoning 内联，而不是发送 `msg_*` 或
  `rs_* item_reference`；
- OpenCode 是否通过 `providerOptions.openai.store` 明确传入了 `false`；
- 代理或上游是否在 fork 发出请求后重写了 `store`。

`headroom-photonmark` 不报错不能作为两个 provider 请求完全相同的证据，因为它加载的是
stock `@ai-sdk/openai`，未配置时可能省略 `store`。

修复后仍需分别验证 `previous_response_id`、batch model 和已有会话历史等场景；普通请求通过
不等同于完整 Responses 兼容性验证。
