# Tool-Search Follow-Up Retry

## 目标

Codex/OpenAI Responses 兼容层收到未配对的 `tool_search_call` 后，可能在同一次 provider 调用中发送内部 follow-up 请求。
这些请求不能把 timeout、HTTP 错误或网络错误伪装成 `tool_search_output(status=completed, tools=[])` 成功结果。

本次修改首先应用于 `openai-fork-tool-search-branching`，随后在独立源码 commit 中同步到 `openai-fork`。
两个 fork 使用相同 helper、HTTP retry 边界和真实 HTTP 测试矩阵；各自原有的 mixed tool-search 行为保持不变。

## OpenCode 1.18.25 的真实策略

本地安装版本为 OpenCode `1.18.25`。
本地安装没有可编辑源码，因此核对了相同 tag `anomalyco/opencode@v1.18.25` 的以下文件：

- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/session/processor.ts`
- `packages/opencode/src/session/retry.ts`
- `packages/opencode/src/session/message-v2.ts`
- `packages/opencode/src/provider/error.ts`
- `packages/opencode/test/session/retry.test.ts`

普通主模型请求把 AI SDK 的 `maxRetries` 设为 `0`。
OpenCode 在 `SessionProcessor` 外层用 `SessionRetry.policy` 重试完整的 `llm.stream(...)` 操作。

策略参数如下：

| 参数 | 值 |
| --- | ---: |
| 初始延迟 | `2000 ms` |
| 指数系数 | `2` |
| jitter | `0%–25%` |
| 无响应 header 时的最大延迟 | `30000 ms` |
| 最大 retry 次数 | `5` |

延迟优先读取：

1. `retry-after-ms`，单位为毫秒；
2. 数字形式的 `retry-after`，单位为秒；
3. HTTP-date 形式的 `retry-after`；
4. 否则使用带 jitter 的指数退避。

OpenCode 明确重试的情况包括：

- AI SDK 标记为 retryable 的 `APICallError`；
- HTTP `429` 和 `5xx`；
- headers/response stream timeout；
- fetch/network/connection reset/refused/lost、DNS 暂时错误；
- overloaded、service unavailable、resource exhausted 等错误文本。

OpenCode 不重试 context overflow、用户 abort、普通 non-retryable `4xx`。
Provider stream error 中的 `insufficient_quota`、`usage_not_included` 和 `invalid_prompt` 也属于 fatal error。

## Compat 的边界

`MAX_CODEX_TOOL_SEARCH_ROUNDS` 只限制 tool-search 协议轮数。
它不表示 HTTP retry 次数。

实现保持两个计数器独立：

- `round=0` 的原始模型请求不在 compat 内重试，仍由 OpenCode 外层策略负责；
- `round>0` 的内部 TSC follow-up 最多进行 `5` 次 HTTP retry；
- follow-up retry 耗尽后原样抛出最后一个 error；
- OpenCode 收到失败后，可以重新执行完整的原始模型请求；
- compat 不跨 provider 调用保存 TSC 成功、失败或 loaded-tools 状态。

因此失败路径是：

```text
OpenCode original request
  -> tool_search_call
  -> compat follow-up
  -> retryable error
  -> compat follows OpenCode retry timing
  -> retry exhausted
  -> throw original error
  -> OpenCode retries or aborts the original request
```

只有 follow-up API 真正返回成功响应时，内部构造的 `tool_search_output(tools=[])` 才会参与后续 compatibility 处理。
错误路径不会返回 provider result，也不会向 OpenCode 提交伪造的 TSC 成功状态。

## 2026-09-09 修复：成功 HTTP 响应中的错误

本次审计确认，原有重试策略已经覆盖 HTTP `429`、`5xx`、超时、网络错误和
`resource_exhausted` 等上游资源不足场景。普通 `round=0` 请求仍由 OpenCode
外层重试，compat 不重复执行这一层，避免两层重试叠加造成请求数放大。

原实现有一个边界遗漏：`postJsonToApi()` 返回 HTTP `2xx` 后，如果 JSON body
包含 `response.error`，或者 `output` 为空，代码会在 retry wrapper 外才构造
`APICallError`。因此下面这种上游响应不会触发隐藏 follow-up 的 retry：

```json
{
  "error": {
    "type": "server_error",
    "code": "server_is_overloaded",
    "message": "Our servers are currently overloaded. Please try again later."
  }
}
```

修复已同步到两个 fork 的 `src/responses/openai-responses-language-model.ts`：

- 将 `response.error` 和空 `output` 的检查移入 `retryWithOpenCodePolicy()` 的
  `execute` 回调；
- transient response error 会按照既有退避策略重试，耗尽后把最后一个错误原样
  返回给 OpenCode；
- 在两个 fork 的 `src/responses/openai-responses-retry.ts` 中新增
  `getOpenCodeResponseErrorStatusCode()`，将 overloaded/service unavailable 映射
  为 `503`，rate limit/resource exhausted 映射为 `429`，其他响应体错误映射为
  `400`；
- 保留 `type`、`code` 和原始 response error，便于 OpenCode 继续进行错误分类；
- `insufficient_quota`、`usage_not_included`、`invalid_prompt` 仍然是 fatal error，
  即使它们被映射为 `429`，也不会无效重试。

目标会话中的
`Invalid type for 'input[279].content[1]': expected an object, but got null instead.`
仍然是 HTTP `400` 的请求体 schema 错误，不属于上游资源不足，继续保持不重试。
重试不会修复已经生成的非法 JSON；这类问题必须修复 prompt/file part 转换或从坏
历史创建干净的 session。

## 2026-09-10 修复：旧版 file part 与图片附件

### 现场定位

最近 30 分钟内更新、但创建时间较早的目标会话是：

- 工作区：`/Volumes/Develop/git/szbl-hpc/nsfc2026`
- 标题：`视觉深度、完整三维模型与物体记忆设定`
- Session ID：`ses_f94acde93ffemwXU0mIQxcpHJq`
- 最后更新时间：2026-09-10 01:57:38

该会话的 provider 诊断文件是
`/Users/galaxy/.local/share/opencode/provider-debug/headroom-openai-fork/ses_f94acde93ffemwXU0mIQxcpHJq.jsonl`。

同一会话中，01:39:47 的 `ProviderHeaderTimeoutError` 被标记为
`retryableByOpenCode=true`，随后 OpenCode 外层重新请求并在 01:45:44 成功。
这证明上游暂时不可用时的既有重试路径正常工作。

01:46:19 的 assistant reasoning 为 `Generating observer images using PIL`。
随后主程序成功读取以下四个 PNG，并为每个 tool result 保存一个图片 attachment：

- `/tmp/prexp-before-observer_top.png`
- `/tmp/prexp-before-observer_front.png`
- `/tmp/prexp-before-observer_side.png`
- `/tmp/prexp-before-agent_camera.png`

01:57:38 的下一次请求有 185 个顶层 input item，`input[184]` 是一个
synthetic `user` item；01:57:41 返回：

```text
Invalid type for 'input[184].content[1]': expected an object, but got null instead.
```

该错误是 HTTP `400`、`invalid_type`，诊断字段为
`retryableByOpenCode=false` 和 `willRetryInCompat=false`。
它不是 OpenAI 资源不足，也不应增加 retry 次数。

### 根因

OpenCode 主程序负责执行 `read`、读取 PNG，并将 attachment 持久化到
`/Users/galaxy/.local/share/opencode/opencode.db` 的 `part.data.state.attachments`。
主程序随后从历史重新组装 ModelMessage，provider fork 只负责把这个 prompt
转换成 Responses API 的 `input`，不会把 `input[184]` 写入数据库。

本机 OpenCode 侧的 `@ai-sdk/provider` `3.0.8` 在
`/Users/galaxy/.config/opencode/node_modules/@ai-sdk/provider/dist/index.d.ts:1070-1157`
定义旧版 `LanguageModelV3FilePart`，其中 `data` 是 `string`、`Uint8Array` 或
`URL`。

fork 自带的 `@ai-sdk/provider` `4.0.7` 在
`/Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/node_modules/@ai-sdk/provider/dist/index.d.ts:1911-1925`
则要求新版 tagged file data，例如 `{ type: 'data', data }` 或
`{ type: 'url', url }`。

旧版 converter 在
`/Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/src/responses/convert-to-openai-responses-input.ts:194-316`
直接读取 `part.data.type`，user content 的 `map` 没有未知形状的默认处理。
当旧版 raw file data 未被识别时，map callback 会返回 `undefined`。
`/Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/node_modules/@ai-sdk/provider-utils/dist/index.js:221-223`
中的 `JSON.stringify` 会将数组元素 `undefined` 序列化为 `null`，于是服务端
看到 `input[184].content[1] = null`。

### 修复方法

已同步修改以下两个 Responses converter：

- `/Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/src/responses/convert-to-openai-responses-input.ts:87-111,252-356`
- `/Users/galaxy/.config/opencode/tool-search-compat/openai-fork/src/responses/convert-to-openai-responses-input.ts:87-111,252-356`

新增的 `normalizeFileData()` 在进入 file data switch 前统一处理：

- raw `string` 转换为 `{ type: 'data', data }`；`data:image/...;base64,...` 会先去掉 Data URL 外层；
- raw `Uint8Array` 转换为 `{ type: 'data', data }`；
- raw `URL` 转换为 `{ type: 'url', url }`；
- 已经是新版 tagged data 的对象保持不变；
- 未知 file data 或 user content 类型显式抛出 `UnsupportedFunctionalityError`，禁止静默产生 `undefined`。

该修复兼容 OpenCode 当前传入的旧版 V3 file part，同时保留 fork 原有的新版 V4
file part 行为。当前 `headroom-openai-fork` 的入口由
`/Users/galaxy/.config/opencode/opencode.jsonc:526-527` 指向
`/Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching/dist/index.js`。

### 验证

两个 fork 的
`test/openai-responses-tool-search-retry.test.ts` 都新增了 raw string、
`Uint8Array`、`URL` 和多个连续图片的转换测试，确保最终 content 不包含
`null`。测试使用真实的 `model.doGenerate()` 路径，不只是调用 retry helper。

在两个目录分别执行：

```bash
cd /Users/galaxy/.config/opencode/tool-search-compat/openai-fork-tool-search-branching
npm run test:tool-search-retry
npx tsc --noEmit --pretty false -p tsconfig.build.json

cd /Users/galaxy/.config/opencode/tool-search-compat/openai-fork
npm run test:tool-search-retry
npx tsc --noEmit --pretty false -p tsconfig.build.json
```

两个 fork 均通过 16 项测试和 TypeScript 检查；两个 `dist` 目录也已重新构建。
修改 provider source 或 bundle 后必须完全退出并重新启动 OpenCode GUI，运行中
已经加载的 provider 不会热更新。

### 现场恢复

如果不能等待重启或不希望重放坏历史，可以按 message boundary 创建干净副本。
本次已创建从图片生成前一刻开始的副本：

- Session ID：`ses_f78824e6dffeYk7negTWliK4dQ`
- 标题：`视觉深度、完整三维模型与物体记忆设定 (fork before observer images)`
- boundary：`msg_087469423001MJ40PtXENY26Mf`
- 副本包含 166 条 message、0 个 attachment；原会话保持不变。

`input[184]` 是运行时数组下标，不是数据库字段，因此不能通过修改数据库中的
“第 184 条”来修复。fork API 只能按 `messageID` 截断；当问题来自同一条
assistant message 的图片 attachment 时，应 fork 到图片生成 assistant message
之前，或在副本中删除 attachment，而不是填充一个空白 input。

## 验证补充

新增真实 HTTP server 测试覆盖：

1. HTTP `200` 加 `response.error=server_is_overloaded` 会 retry 并成功；
2. HTTP `200` 加 `response.error=insufficient_quota` 不会 retry，并将错误返回给
   调用方；
3. response error 的状态码映射保留 transient/fatal 边界。

两份 fork 均通过 `npm run test:tool-search-retry` 和
`npx tsc --noEmit --pretty false -p tsconfig.build.json`。修改后需要完全退出并
重启 OpenCode GUI，因为 provider bundle 在进程启动时加载，不会热更新。

## Package Boundary

fork package 不能直接 import OpenCode 内部的 `SessionRetry`。
因此 `src/responses/openai-responses-retry.ts` 精确复制 OpenCode 1.18.25 的 retry 常量、delay 和分类语义，并在源码中记录上游 tag 和路径。

另外，fork 使用非 streaming `postJsonToApi()` 执行 hidden follow-up。
为了与 OpenCode 对 streaming provider error 的处理一致，helper 会把结构化错误码 `insufficient_quota`、`usage_not_included` 和 `invalid_prompt` 视为 fatal，即使 HTTP status 为 `429`。

## Diagnostics

branching JSONL 中：

- `round` 是 compatibility round；
- `attempt` 是当前 round 内从 `0` 开始的 HTTP attempt；
- `requestCount` 统计真实 HTTP 请求次数；
- `hiddenRoundCount` 每个 hidden compatibility round 只增加一次，不随 retry 增加；
- `request_error` 记录 retry 分类、是否本地重试和 delay，但不记录 prompt、tool arguments 或 encrypted reasoning。

follow-up 最终失败时不会写 `response` 事件。
最后一个 `request_error` 后会把相同 error 抛给 OpenCode。

base fork 保留原有 console diagnostic，并增加同样从 `0` 开始的 `attempt` 字段。
两个 fork 都不会在失败路径写入成功响应或返回 provider result。

## 测试

源码测试使用真实本地 HTTP server 和 provider `doGenerate()`，而不是只调用 retry helper。
测试命令：

```bash
cd openai-fork-tool-search-branching
npm run test:tool-search-retry

cd ../openai-fork
npm run test:tool-search-retry
```

当前覆盖：

1. TSC follow-up 正常成功；
2. response-header timeout 后 retry 成功；
3. HTTP `503` 后 retry 成功；
4. HTTP `429` 的 `rate_limit` 与 `too_many_requests` 分别 retry 成功；
5. `Retry-After` 毫秒和秒格式；
6. 五次 retry 耗尽后抛出原始 `503 APICallError`；
7. `401` 不重试；
8. HTTP `429 insufficient_quota` 不重试；
9. invalid request `400` 不重试；
10. 外层重新调用原始 request 时重新执行 TSC；
11. hidden `503` 六次请求耗尽后抛错，外层重新调用原始 request 时 TSC 从头执行并成功；
12. 失败调用不返回 provider result；
13. retry 使用相同 follow-up input，不提交跨调用状态；
14. 原有 TSC 成功路径保持可用。
