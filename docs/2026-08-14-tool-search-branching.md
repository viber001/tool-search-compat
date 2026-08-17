# Tool Search Continuation Branching 实验

日期：2026-08-14

模型：`gpt-5.6-luna`

接口：`POST http://127.0.0.1:8787/v1/responses`

```text
A tsc B fc → A B fc fco

SUCCESS
```

## 实验背景

当前 fork 会在 provider 内部消费没有匹配 output 的 `tool_search_call`。已有实现的 hidden
follow-up 仍发送 canonical assistant output、pending `tool_search_call` 和合成的
`tool_search_output(tools: [])`：

```text
A tsc(C) B fc(E)
        ↓ hidden
A B tsc(C) tso(C)
        ↓ 返回 OpenCode
A B fc(E)
        ↓ OpenCode 执行 E
A B fc(E) fco(E)
```

本实验验证更激进的分支是否被真实 Responses API 接受：provider 在自己的状态中已经见过并
消费 `tsc(C)` 后，后续由 OpenCode 重建的完整 history 直接省略 C，不再发送 C 或对应的
`tso(C)`：

```text
A tsc(C) B fc(E)
        ↓
A B fc(E) fco(E)
```

## 语义边界

实验使用当前 OpenCode 实际采用的 **stateless manually managed history** 模式：

- `store: false`；
- 没有 `previous_response_id`；
- 没有 `conversation`；
- 后续请求重新发送完整 canonical history。

因此这是一次新的无状态 Responses request，而不是尝试删除已经存入
`previous_response_id` 或 Conversations API 链中的 item。该边界很重要：实验结论适用于当前
fork/OpenCode 的完整 history 重放模式；不能外推为 stateful response chain 支持删除历史 item。

A、B、C 和 E 都分别来自本次实验中的真实 `gpt-5.6-luna` Responses API response。官方
client tool search 通常在产生 `tool_search_call` 后暂停等待 application output，所以实验没有
要求单个 response 同时生成全部四项，而是按目标定义把这些真实较早输出组成 provider 已知的
概念 history，然后只向 Phase 1 request 重放 A、B 和 E。

## 官方明确规定

### Client-executed tool search

[OpenAI Tool search 文档][tool-search]明确给出的正常 client continuation 是：

1. 第一轮返回 `tool_search_call`，`execution: "client"` 且有非空 `call_id`；
2. application 执行搜索；
3. 下一轮在 `firstResponse.output` 后追加 `tool_search_output`；
4. `tool_search_output.call_id` 必须与 call 的 `call_id` 相同。

这规定了“继续同一次 client tool search”的标准协议。本实验没有根据 `call_id` 可配对就推断
任意 sequence 合法，而是把省略 `tsc/tso` 的 sequence 真正发送给 API。

### Conversation state

[OpenAI Conversation state 文档][conversation-state]明确区分：

- manually managed history：每次请求独立，客户端把希望保留的历史 items 放入新 request；
- `previous_response_id`：服务端串接已有 response state；
- Conversations API：服务端持久保存 conversation items。

官方示例建议在正常手工 continuation 中保留完整 `response.output`，包括 reasoning items。官方
文档没有明确保证可以从 stateful chain 中删除任意 `tool_search_call`。本实验只验证无状态完整
history 分支的实际接受情况。

## 官方 SDK 行为

AI SDK V4 的 `LanguageModelV4ToolCallPart` 使用 `toolCallId` 标识 call，
`LanguageModelV4ToolResultPart` 使用同一个 `toolCallId` 关联 result。当前项目 fork 自官方
`@ai-sdk/openai@4.0.37` 的 Responses serializer 继续使用这条普通 function 路径：

- assistant tool call 转换为 `function_call.call_id = part.toolCallId`；
- tool result 转换为 `function_call_output.call_id = part.toolCallId`；
- 普通 client-executed function call 不用 `fc_* item_reference` 代替，因为 output 必须通过
  `call_id` 与 call 配对。

相关实现：

- `openai-fork/src/responses/convert-to-openai-responses-input.ts:462-620`
- `openai-fork/src/responses/convert-to-openai-responses-input.ts:907-963`
- `openai-fork/src/responses/convert-to-openai-responses-input.ts:1276-1288`

## 项目 Git 历史

| Commit | 与本实验相关的变化 |
| --- | --- |
| `b40903e` | hidden follow-up 不再 raw replay `rs_*` reasoning ID，改用 encrypted reasoning。 |
| `224345d` | 正常跨轮 history 避免 `msg_*` / `rs_* item_reference`。 |
| `c590496` | 为旧 OpenCode history 中无法重建的 stale `tsc_*` 增加防御。 |
| `afe6773` | pending 判断从仅 client call 扩展为所有没有匹配 `tso` 的 call，包括 endpoint 误标的 server call。 |
| `8fb31aa` | mixed `tsc + function_call` 中暂存普通 function call，不把它放进 hidden follow-up。 |
| `a447aaa` | 将 broad tool-search reference 开关收窄为只丢弃未知、无法重建的 `tsc_*` history。 |
| `eeddc0c` | hidden assistant output 复用 `convertToOpenAIResponsesInput()` 生成 canonical replay，修复 raw/canonical prompt-cache prefix 差异。 |

这些提交解释了当前实现为什么仍把 `tsc/tso` 放进 hidden follow-up：它最初用于补齐兼容
endpoint 返回的 pending call，同时避免把普通 `function_call` 提前发送到没有 output 的内部
request。本实验测试的是后续 OpenCode continuation 是否还必须保留这对中间协议 item。

## 当前代码路径

`openai-fork/src/responses/openai-responses-language-model.ts` 当前流程：

1. `:948-959` 收集已有 `tool_search_output.call_id`，识别没有匹配 output 的 pending call。
2. `:971-995` 从 OpenCode 可见 output 中移除 pending `tsc`；mixed path 暂存普通
   `function_call`。
3. `:1010-1018` 把 A/B 类 assistant output 映射回 AI SDK prompt，并复用
   `convertToOpenAIResponsesInput()` 生成 canonical input。
4. `:1020-1033` 构造当前 hidden request：canonical A/B、pending `tsc`、合成 `tso`。
5. `:1096-1129` client tool-search item 不返回 OpenCode。
6. `:1306-1329` 普通 `function_call` 返回 OpenCode，由 OpenCode 执行并在下一轮产生
   `function_call_output`。

已有 prompt-cache request-level mock 记录见
[`2026-08-13-tool-search-prompt-cache.md`](./2026-08-13-tool-search-prompt-cache.md)。本文件增加的
是实际远端 Responses API sequence 合法性证据。

## 实验 Transport

实验脚本位于系统临时目录，不属于仓库。它直接导入当前编译产物：

```text
openai-fork/dist/index.js
```

并通过 fork 已有的：

```ts
createOpenAI({ baseURL, apiKey, fetch })
```

构造请求。`fetch` 只记录 request/response，不重新实现 serializer。请求使用与真实 OpenCode
transport 相同的 `x-session-affinity` 和 `x-session-id`；认证值没有写入记录或本文。

只使用了 `gpt-5.6-luna`，没有调用 `gpt-5.6-sol` 或其他模型。

## 较早输出的真实 API 证据

### A

```text
response.id: resp_03d4578edf023e9e016a7ecd5214648191ab44feaa13c2ff31
HTTP: 200
output: message("A_REAL_HISTORY_MARKER")
usage: input=33 cached=0 output=9 total=42
```

### tool_search_call(C)

真实 client tool-search response：

```json
{
  "type": "tool_search_call",
  "id": "tsc_0bd23d8d44102f2a016a7ece86df8c87d0ad08ca2e436ba19a",
  "execution": "client",
  "call_id": "call_c936QNrcGwMveZR6rNwiNwot",
  "status": "completed",
  "arguments": { "query": "branch_probe" }
}
```

```text
response.id: resp_0bd23d8d44102f2a016a7ece85e90c87d097873544206cb0c3
HTTP: 200
usage: input=73 cached=0 output=21 total=94
```

没有向这次 response 发送 `tool_search_output`；脚本在捕获真实 C 后停止该 call 的正常 hidden
continuation。

### B

```text
response.id: resp_0f39f479743646eb016a7ece881ff08191a69c4a3ef2611c09
HTTP: 200
output: message("B_REAL_HISTORY_MARKER")
usage: input=33 cached=0 output=9 total=42
```

### function_call(E)

```json
{
  "type": "function_call",
  "id": "fc_0969e5d639173af7016a7ece8c4d108191b5e2c3d82015bcc2",
  "call_id": "call_Qk8x8NnyPfyGUroFUy8Nt6Rf",
  "name": "branch_probe",
  "arguments": "{\"marker\":\"E_REAL\"}",
  "status": "completed"
}
```

```text
response.id: resp_0969e5d639173af7016a7ece8b74e08191b26222468a7f12a6
HTTP: 200
usage: input=72 cached=0 output=19 total=91
```

## Phase 1 实际 Request

发送给真实 Responses API 的 request 没有 `tool_search_call`、没有 `tool_search_output`、没有
`previous_response_id`，也没有 `conversation`：

```json
{
  "model": "gpt-5.6-luna",
  "input": [
    {
      "role": "developer",
      "content": "This is a Responses continuation experiment. After the branch_probe output, reply exactly BRANCH_CONTINUATION_OK."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "Continue the previously generated assistant history after its function result."
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        { "type": "output_text", "text": "A_REAL_HISTORY_MARKER" }
      ]
    },
    {
      "role": "assistant",
      "content": [
        { "type": "output_text", "text": "B_REAL_HISTORY_MARKER" }
      ]
    },
    {
      "type": "function_call",
      "call_id": "call_Qk8x8NnyPfyGUroFUy8Nt6Rf",
      "name": "branch_probe",
      "arguments": "{\"marker\":\"E_REAL\"}"
    },
    {
      "type": "function_call_output",
      "call_id": "call_Qk8x8NnyPfyGUroFUy8Nt6Rf",
      "output": "{\"ok\":true,\"marker\":\"E_REAL_OUTPUT\"}"
    }
  ],
  "max_output_tokens": 32000,
  "store": false,
  "include": ["reasoning.encrypted_content"],
  "reasoning": {
    "effort": "low",
    "summary": "auto"
  }
}
```

实际 item 序列：

```text
developer
user
A
B
function_call(E)
function_call_output(E)
```

断言：

```text
contains tool_search_call: false
contains tool_search_output: false
fc.call_id == fco.call_id: true
```

## Phase 1 实际 Response

```text
HTTP status: 200
response.status: completed
finish reason: stop
error: null
text: BRANCH_CONTINUATION_OK
```

相关 `response.output`：

```json
[
  {
    "type": "reasoning",
    "id": "rs_0dc86d2abf0f0a42016a7ece8dd52c8191a92808ae268858ec",
    "summary": [],
    "encrypted_content": "[redacted: 1336 chars]"
  },
  {
    "type": "message",
    "id": "msg_0dc86d2abf0f0a42016a7ece8e7a4c819196c0c9e97d3455e2",
    "role": "assistant",
    "status": "completed",
    "phase": "final_answer",
    "content": [
      {
        "type": "output_text",
        "text": "BRANCH_CONTINUATION_OK",
        "annotations": [],
        "logprobs": []
      }
    ]
  }
]
```

Usage：

```json
{
  "input_tokens": 118,
  "input_tokens_details": {
    "cache_write_tokens": 0,
    "cached_tokens": 0
  },
  "output_tokens": 31,
  "output_tokens_details": {
    "reasoning_tokens": 19
  },
  "total_tokens": 149
}
```

## 错误检查

以下错误均未出现：

- `No tool output found`；
- `item_reference not found`；
- invalid input item；
- invalid sequence；
- tool-search continuation error；
- 要求为历史 C 补交 `tool_search_output`。

普通 function pair 正常：

```text
function_call.call_id        = call_Qk8x8NnyPfyGUroFUy8Nt6Rf
function_call_output.call_id = call_Qk8x8NnyPfyGUroFUy8Nt6Rf
```

模型继续生成并以 `stop` 完成。

## Hidden encrypted reasoning 替换实验

后续又验证了一个更窄的方案：先执行 hidden `tsc/tso` follow-up，再只把 hidden
response 的 `reasoning.encrypted_content` 放进 OpenCode 分支，删除 `tsc/tso` 和 hidden
可见 message：

```text
A B tsc tso
      ↓ hidden response
encrypted reasoning R + hidden message
      ↓ branch
A B R fc fco
```

[OpenAI Reasoning 文档][reasoning]确认，`store: false` 时 encrypted reasoning 是 stateless
reasoning continuity 的载体；但文档同时建议 function-calling flow 回放最后一个 user message
之后的全部 reasoning、call 和 output items，并保持这些 items 不变。[Responses migration
文档][migrate]也要求 stateless flow preserve and replay every returned reasoning item。官方没有承诺
可以只保留一个在 `tsc/tso` 之后生成的 reasoning item，同时删除它所依赖的 tool-search items。

网络恢复后，实验被改成只验证一个新发生的事实，而不是要求恢复 query 或完整历史：

```text
tsc → tso(tools: [])
```

hidden request 明确要求模型检查 `tools` 是否为空、把这个刚观察到的事实保留在 reasoning state，
然后只输出固定文本 `HIDDEN_DONE`。下一分支出现普通 `branch_probe` output 后，模型必须只回答：

```text
EMPTY | NONEMPTY | UNKNOWN
```

其中 `first-only` reasoning 产生于 `tso([])` 之前，`first + hidden` 比它新增的唯一模型状态就是
hidden response 的 reasoning item，因此这组对照直接测试“刚新增的 thinking 是否让分支记得
`tso([])`”。

真实 `gpt-5.6-luna` treatment/control 使用以下共同边界：

- `store: false`；
- 没有 `previous_response_id` 或 `conversation`；
- branch request 没有 `tool_search_call` 或 `tool_search_output`；
- branch 仍包含匹配的普通 `function_call/function_call_output`；
- `reasoning.context: "all_turns"`；
- 同时测试 reasoning 去掉 `id` 与保留真实 `rs_*` item `id`；
- 同时测试只带 reasoning 与带上配对 hidden message；
- 另启用 `reasoning.summary: "auto"`，区分 summary 与 encrypted state。

网络层不把 `UNKNOWN` 当结果：每个 request 都要求 HTTP 成功、response
`status: "completed"`、`error: null`、存在 response ID 和 usage，否则整轮失败。重测中的所有
请求都在第一次 attempt 成功；没有 retry、5xx、incomplete response 或 transport error。

两组各 3 次的严格结果：

| Branch input | `EMPTY` | `UNKNOWN` 或其他 |
| --- | ---: | ---: |
| 不带 reasoning 的 control | 0/6 | 6/6 |
| 只带 first reasoning（发生在 `tso` 前） | 0/6 | 6/6 |
| 只带 hidden encrypted reasoning | 0/6 | 6/6 |
| first + hidden encrypted reasoning | 0/6 | 6/6 |
| 保留 hidden reasoning `id` | 0/6 | 6/6 |
| reasoning + 配对 hidden message | 0/6 | 6/6 |
| 完整保留 `tsc/tso` 的 positive control | 6/6 | 0/6 |

每次 hidden response 都真正收到了 `tso(tools: [])`，输出 `HIDDEN_DONE`，并返回 encrypted
reasoning；记录到的 encrypted payload 长度约为 1272–1444 字符，reasoning token 也大于 0。
开启 `summary: "auto"` 后，summary 通常为空，唯一出现的 summary 是
`Confirming required reply format`，没有记录 `tools` 为空这个事实。

完整历史 positive control 6/6 回答 `EMPTY`，证明模型、阶段提示和 `tso([])` 本身都正常；失败
只发生在删掉 `tsc/tso` 的 selective branch。所有 selective branch 也都被 API 接受，因此实验
区分了两个结论：

```text
协议接受 selective encrypted reasoning replay: YES
分支可观察到“刚收到 tso([])”这段新增记忆: NO
```

encrypted payload 本身不可解密检查，因此不能断言服务器内部从未表示过该事实。可以确定的是：
当它脱离产生它的 `tsc/tso` sequence 被单独放入新分支时，模型无法访问这段事实；可能是该事实
没有写进 reasoning item，也可能是服务端把缺少因果 items 的 reasoning state 忽略为不兼容。
无论是哪一种，当前 API 下它都不能作为可用的新增记忆。一次 HTTP 200 只证明 payload 合法，
不证明 reasoning continuity 生效。

因此当前 branching variant 不执行额外 hidden request 来获取 reasoning，也不把 hidden
reasoning 注入下一分支。这样既避免额外 latency/token cost，也避免把一个在 `tsc/tso` 之后生成
的 opaque item 放进已经删除 `tsc/tso` 的 sequence。若未来 API 明确支持 selective reasoning
branching，或稳定的真实评测证明其语义连续性，再单独增加实验开关。

## 结论

```text
A tsc B fc → A B fc fco

SUCCESS
```

在当前 OpenCode 使用的无状态完整 history 重放模式中，`tool_search_call` 可以由 provider 内部
消费，并从后续 continuation history 中消解；真实 Responses API 不要求后续 request 携带对应
`tool_search_output`。

更精确地说，API 对本次实际收到的：

```text
A B fc(E) fco(E)
```

进行了独立 sequence 校验并接受。它没有因为 provider 的较早真实输出中曾存在
`tool_search_call(C)`，而要求本次无状态 request 同时重放 C 或 `tso(C)`。

第一阶段成功，因此按实验设计立即停止；没有执行：

```text
A B fc fco tsc tso
```

第二阶段，也没有修改 fork 代码或提交 commit。

## 可切换实现

实验通过后，方案被放入独立目录：

```text
openai-fork-tool-search-branching/
```

该目录保留基础 fork 的纯 pending tool-search hidden follow-up，但在同一 response 同时包含
pending `tool_search_call` 和普通 `function_call` 时，直接向 OpenCode 返回过滤后的 A/B 与
普通 function call，不再发送 hidden `tsc/tso` request。OpenCode 执行 function call 后构造的
下一轮 canonical history 因而是：

```text
A B function_call function_call_output
```

独立 provider 入口示例：

```text
file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/dist/index.js
```

[tool-search]: https://developers.openai.com/api/docs/guides/tools-tool-search
[conversation-state]: https://developers.openai.com/api/docs/guides/conversation-state
[reasoning]: https://developers.openai.com/api/docs/guides/reasoning
[migrate]: https://developers.openai.com/api/docs/guides/migrate-to-responses
