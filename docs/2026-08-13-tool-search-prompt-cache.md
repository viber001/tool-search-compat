## OpenCode 加 NOP tool

| Cycle | **Local Context**                          | **Responses API Input** | **OpenAI Cached Input**                | **OpenAI UnCached Input** | **response.output_item.added** |
| ----: | ------------------------------------------ | ----------------------- | -------------------------------------- | ------------------------- | ------------------------------ |
| **0** | `usr_msg(A)`                                                   | `=` | —                                                 |   `usr_msg(A)` | `ass_msg(B) tsc(C) ass_msg(D)` |
| **1** | usr_msg(A) ass_msg(B) tsc(C) ass_msg(D) `tso([])`              | `=` | `usr_msg(A)`        |       `ass_msg(B) tsc(C) ass_msg(D) tso([])` | `fc(E)`                        |
| **2** | usr_msg(A) ass_msg(B) tsc(C) ass_msg(D) tso([]) fc(E) `fco(F)` | `=` | `usr_msg(A) ass_msg(B) tsc(C) ass_msg(D) tso([])` | `fc(E) fco(F)` | `...`                          |


## Forked @ai-sdk/openai


| Cycle | **Local Context**                               | **Responses API Input**                           | **OpenAI Cached Input**  | **OpenAI UnCached Input**  | **response.output_item.added** |
| ----: | ----------------------------------------------- | ------------------------------------------------- | ------------------------ | -------------------------- | ------------------------------ |
| **0** | `usr_msg(A)`                                    | `=`                                               | —                        | `usr_msg(A)`               | `ass_msg(B) tsc(C) ass_msg(D)` |
| **1** | usr_msg(A) ass_msg(B) ass_msg(D)                | usr_msg(A) ass_msg(B) tsc(C) ass_msg(D) `tso([])` | `usr_msg(A)` | `ass_msg(B) tsc(C) ass_msg(D) tso([])` | `fc(E)`                        |
| **2** | usr_msg(A) ass_msg(B) ass_msg(D) fc(E) `fco(F)` | `=`                                               | `usr_msg(A) ass_msg(B)`  | `ass_msg(D) fc(E) fco(F)`  | `...`                          |


## 说明

这两张表描述的是 OpenCode 使用 NOP `tool_search` 与 forked
`@ai-sdk/openai` 在 provider 内部处理 `tool_search` 时，本地 context、实际
Responses API input 和 output item 的演化。

- **Local Context**：OpenCode 当前维护、准备在后续请求中继续使用的 context list。
- **Responses API Input**：实际发送给 Responses API 的完整 `input`；`=` 表示与
  Local Context 相同。
- **OpenAI Cached Input**：根据连续请求的共同 prefix 推测的缓存部分，不是客户端单独
  发送的字段，也不是 API 返回的逐 item 映射。
- **OpenAI UnCached Input**：根据上述理论划分推测的、当前 request 中未命中已有 cache
  的部分。
- **`response.output_item.added`**：本次 response 新增的 output items；它们随后由
  OpenCode 加入 context，或者由 fork 的兼容层在内部处理。

表注：

```text
usr_msg = type:"message", role:"user"
ass_msg = type:"message", role:"assistant"
msg     = type:"message"
tsc     = type:"tool_search_call"
tso     = type:"tool_search_output"
fc      = type:"function_call"
fco     = type:"function_call_output"
```

`rs`（`type:"reasoning"`）可以出现在这些 item 之间，表中省略。

## Fork 的关键区别

关键差异位于 fork 的 Cycle 1。OpenCode 本地还没有看到 `tsc(C)` 和
`tso([])`：

```text
Local Context:
usr_msg(A) ass_msg(B) ass_msg(D)
```

但 fork 在 provider 内部接管 pending `tool_search_call`，实际发送隐藏 follow-up：

```text
Responses API Input:
usr_msg(A) ass_msg(B) tsc(C) ass_msg(D) tso([])
```

服务器随后返回：

```text
response.output_item.added:
fc(E)
```

fork 内部处理的完整序列是：

```text
usr_msg(A) ass_msg(B) tsc(C) ass_msg(D) tso([]) fc(E)
```

但返回给 OpenCode 时，内部完成的 `tsc(C)` 和 `tso([])` 不会进入后续本地
context：

```text
usr_msg(A) ass_msg(B) ass_msg(D) fc(E)
```

因此：

```text
NOP:
Local Context = Responses API Input

Fork:
Local Context != Responses API Input
        ^
    hidden follow-up
```

## Cached Input 的边界

表中的 **OpenAI Cached Input 是对共同 prefix 的理论示意**。实际缓存读取和写入必须以
Responses API 返回的以下字段为准：

```text
usage.input_tokens_details.cached_tokens
usage.input_tokens_details.cache_write_tokens
```

GPT-5.6 支持 implicit 和 explicit prompt caching。[GPT-5.6 model guidance][1] Implicit
模式下，服务会在最新的 user 或 tool message 设置隐式 breakpoint。缓存命中要求：

1. breakpoint 之前的 rendered prefix 完全一致；
2. prefix 至少有 1,024 tokens；
3. 先前请求确实在 eligible breakpoint 写入了 cache；
4. 请求使用一致的 `prompt_cache_key`，才能获得更可靠的匹配和路由。

OpenAI 不会自动回退到 breakpoint 之前任意未标记的最长共同 prefix。因此，表中 fork
Cycle 2 的：

```text
usr_msg(A) ass_msg(B)
```

只表示 hidden input 与下一轮 OpenCode input 的逻辑共同 prefix。若 `ass_msg(B)` 之后没有
eligible breakpoint，这个 prefix 不一定能够实际产生 cache read，`cached_tokens` 仍可能为
0。

Cycle 0 到 Cycle 1 中，`usr_msg(A)` 已作为先前 input 的最新 user message 出现，因此在满足
长度、key、TTL 和实际写入条件时，可以把它视为可能复用的 implicit breakpoint。Cycle 1
中新加入的：

```text
ass_msg(B) tsc(C) ass_msg(D) tso([])
```

是否被写入、后续能否读取，不能仅从本地 context list 判断。

GPT-5.6 的 cache write 按 uncached input rate 的 1.25 倍计费，cache read 使用折扣价格。
如果 `cache_write_tokens` 持续较高但 `cached_tokens` 较低，应检查 implicit breakpoint 是否
包含了会在后续 request 中消失或变化的内容。[OpenAI prompt caching 文档][2]

## 2026-08-13 Request-Level Diff 实测

使用真实 `opencode run` 驱动本地 mock Responses endpoint，模型配置名为
`gpt-5.6-luna`。mock 只替代远端响应；初始 prompt、provider 转换、hidden follow-up、
普通 `read` 工具执行和下一 OpenCode cycle 都由 OpenCode 与当前 fork 实际完成。

比较单位是完整 JSON item 的逐项相等，不只是 `type`。初始请求都有两个共同 item：

```text
developer
user
```

### 修复前：返回 `[msg(B), tsc(C)]`

mock 在 hidden follow-up 后返回 `[msg(D), fc(E)]`，OpenCode 执行 E 并加入 `fco(F)`：

```text
hidden request:
developer user raw_ass_msg(B) tsc(C) tso(C)

next OpenCode request:
developer user opencode_ass_msg(D) fc(E) fco(F)
```

完整 JSON item 的共同 prefix 是 2 项，只到 `developer user`。当前纯 tool-search 路径
不会把首个响应的 `msg(B)` 合并回最终 provider result，因此下一 OpenCode request 从
`msg(D)` 开始。

### 修复前：返回 `[msg(B), tsc(C), fc(E)]`

当前 mixed path 不把 E 放进 hidden follow-up：

```text
hidden request:
developer user tsc(C) tso(C)

next OpenCode request:
developer user opencode_ass_msg(B) fc(E) fco(F)
```

完整 JSON item 的共同 prefix 同样是 2 项。

### 不同 tail 方案

基于 OpenCode 实际打印到 mock endpoint 的 request body，又比较了以下候选输入：

| 场景 | Hidden suffix 方案 | 完整 JSON item prefix | 仅按 item type 的 prefix |
| --- | --- | ---: | ---: |
| `[msg, tsc]` | 当前 raw `msg(B) tsc(C) tso(C)`，下一轮不保留 B | 2 | 2 |
| `[msg, tsc]` | 保留 B，但 hidden 仍使用 raw response message | 2 | 2 |
| `[msg, tsc]` | 保留 B，hidden 使用 OpenCode canonical message | 3 | 3 |
| `[msg, tsc, fc]` | 当前 `tsc(C) tso(C)` | 2 | 2 |
| `[msg, tsc, fc]` | raw `msg(B) tsc(C) tso(C)` | 2 | 2 |
| `[msg, tsc, fc]` | OpenCode canonical `msg(B) tsc(C) tso(C)` | 3 | 3 |

raw Responses message 与 OpenCode 下一轮重新序列化的 assistant message 并不相同：

```text
raw message keys:
type role id phase status content

OpenCode-reserialized message keys:
role content id phase

raw output_text keys:
type text annotations logprobs

OpenCode-reserialized output_text keys:
type text
```

因此，仅把 raw `msg` 或 `tsc/tso` 移到数组尾部不能增加精确 cache prefix。真正要让
prefix 增长，hidden request 必须使用与下一 OpenCode cycle 完全相同的 canonical item 表示；
纯 `[msg, tsc]` 路径还必须把 B 合并回最终 provider result。

### 2026-08-14 Canonical Replay 实现后复测

实现没有新增 wire serializer。`getArgs()` 把当前所有 input conversion 参数封装为同一个
`convertPromptToInput()`；初始 OpenCode prompt 和 hidden replay 都调用现有
`convertToOpenAIResponsesInput()`。response 中 assistant 可见的 message、reasoning 和
compaction 只先映射为 AI SDK assistant prompt part，再交给该 converter 生成 wire item。

使用同样的真实 `opencode run` + mock endpoint 流程，按完整 JSON item 断言：

```text
返回 [msg(B), tsc(C)]：

hidden request:
developer user B_canonical tsc(C) tso(C)

next OpenCode request:
developer user B_canonical D_canonical fc(E) fco(F)

exact common prefix: 3 items
```

纯路径会把首轮 B 合并回最终 provider result，因此下一轮仍包含同一个 `B_canonical`。

```text
返回 [msg(A), tsc(B), msg(C), fc(D)]：

hidden request:
developer user A_canonical C_canonical tsc(B) tso(B)

next OpenCode request:
developer user A_canonical C_canonical fc(D) fco(E)

exact common prefix: 4 items
```

mixed hidden request 中不存在 `fc(D)`；OpenCode 收到 A、C、D，执行 D 后才在下一 cycle 加入
`fco(E)`。最终规模复测将 A 设为 100,000 字符、C 设为 3,000 字符；两个 canonical
assistant item 仍与下一 OpenCode request 逐 JSON item 相等。

这证明大上下文 A/C 不再因为 raw Responses item 与 canonical item 的字段差异从第一项开始
失配。是否实际获得对应数量的 `cached_tokens` 仍取决于兼容服务的 cache key、breakpoint、
TTL 和路由；request-level prefix 相等是必要条件，不是计费命中的充分条件。

最终编译产物另用真实兼容服务做了低成本 sanity check：通过临时内存配置加载本地 fork，
实际调用 `headroom-openai-fork/gpt-5.6-luna` 的 `low` variant，让 OpenCode 读取仓库 README。
请求成功并完成正常 `function_call/function_call_output`；诊断显示两次 provider 调用均为
`round: 0`，没有触发 hidden tool-search round。该检查证明最终 `dist` 可以正常加载并调用真实
服务，但不证明 canonical `tsc/tso` hidden 排列已被真实服务接受，也不用于推断 cache 命中。

## Future: Explicit Prompt-Cache Breakpoint

当前 fork 不会因为 `tool_search` history divergence 自动添加 explicit prompt-cache
breakpoint。

OpenCode 已支持 provider 级 `setCacheKey`，用于建立 `promptCacheKey`；当前 OpenCode 配置
schema 没有提供专门的 prompt-cache breakpoint 设置。Fork 使用的 OpenAI SDK 已具备把
provider metadata 转换为 `prompt_cache_breakpoint: { mode: "explicit" }` 的能力，但不应在
缺少 OpenCode 标准入口时自行引入模型专用配置。

对于 `tool_search` 兼容路径，理想的 explicit breakpoint 应放在 hidden follow-up 前后都
保证保留的最后一个 content block 上。例如内部 input 为：

```text
usr_msg(A)
ass_msg(B)
tsc(C)
ass_msg(D)
tso([])
```

而 `tsc(C)` 和 `tso([])` 不会进入 OpenCode context 时，目标边界是：

```text
usr_msg(A)
ass_msg(B)  <-- explicit cache breakpoint
tsc(C)
ass_msg(D)
tso([])
```

不过 Responses API 的 explicit breakpoint 只能附加到支持的 content block，例如
`input_text`、`input_image` 和 `input_file`，不能直接附加到顶层 message 或任意 output item。
真正实现时必须把“最后稳定 item”映射到一个合法且至少形成 1,024-token prefix 的 content
block，不能直接在 `ass_msg(B)` 对象上添加字段。

### When to implement

目前不要增加 fork-specific breakpoint 机制。等 OpenCode 暴露标准配置或 API 后，fork 应
复用该机制，而不是引入硬编码模型检测。届时实现应：

1. 识别 hidden `tool_search` history divergence 之前的最后稳定 prefix。
2. 在对应、合法的 Responses API content block 上设置
   `prompt_cache_breakpoint: { mode: "explicit" }`。
3. 根据预期写入策略决定保留 implicit 模式，或使用
   `prompt_cache_options.mode: "explicit"` 禁用变化 suffix 的 implicit write。
4. 保持 `tool_search_call` 和 `tool_search_output` 兼容处理不变。
5. 不对没有已知 history divergence 的普通 request 添加 breakpoint。
6. 保留现有 `setCacheKey` 和 `promptCacheKey` 行为。
7. 通过 `cached_tokens`、`cache_write_tokens`、input tokens、延迟和实际费用验证收益。

目标是让 cache boundary 跟随真正的 OpenCode history boundary，而不是耦合到某个模型名或
fork 的内部实现细节。

[1]: https://developers.openai.com/api/docs/guides/latest-model "Using GPT-5.6"
[2]: https://developers.openai.com/api/docs/guides/prompt-caching "Prompt caching"
