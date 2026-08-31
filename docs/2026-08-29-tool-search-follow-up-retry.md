# Tool-Search Follow-Up Retry

## 目标

Codex/OpenAI Responses 兼容层收到未配对的 `tool_search_call` 后，可能在同一次 provider 调用中发送内部 follow-up 请求。
这些请求不能把 timeout、HTTP 错误或网络错误伪装成 `tool_search_output(status=completed, tools=[])` 成功结果。

本次修改首先应用于 `openai-fork-tool-search-branching`。
`openai-fork` 使用相同 helper 和测试策略，在独立源码 commit 中同步。

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

## 测试

源码测试使用真实本地 HTTP server 和 provider `doGenerate()`，而不是只调用 retry helper。
测试命令：

```bash
cd openai-fork-tool-search-branching
npm run test:tool-search-retry
```

当前覆盖：

1. TSC follow-up 正常成功；
2. response-header timeout 后 retry 成功；
3. HTTP `503` 后 retry 成功；
4. HTTP `429 rate_limit_exceeded` 后 retry 成功；
5. `Retry-After` 毫秒和秒格式；
6. 五次 retry 耗尽后抛出原始 `503 APICallError`；
7. `401` 不重试；
8. `insufficient_quota` 不重试；
9. invalid request `400` 不重试；
10. 外层重新调用原始 request 时重新执行 TSC；
11. 失败调用不返回 provider result；
12. retry 使用相同 follow-up input，不提交跨调用状态；
13. 原有 TSC 成功路径保持可用。
