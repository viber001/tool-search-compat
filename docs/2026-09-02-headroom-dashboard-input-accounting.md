# Headroom Dashboard `Input=0` 统计问题

日期：2026-09-02

## 环境

- Headroom：`0.37.0`
- Proxy：`127.0.0.1:8787`
- 上游：`https://codex.photonmark.com/openai/v1`
- 客户端：OpenCode，OpenAI Responses API
- 启动脚本：`/Volumes/Develop/git/szbl-hpc/Qbics/new/headroom.sh`
- 当前工作区已有 `/Users/galaxy/.config/opencode/AGENTS.md`，因此没有复制 Qbics 目录中的 `AGENTS.md`。

## 现象

Dashboard 的 Recent Requests 中，一部分请求显示 `Input=0`，另一部分显示正常的大输入量。

异常记录的共同特征：

- `provider=openai`
- `model=gpt-5.6-luna`
- `input_tokens_original=3`
- `input_tokens_optimized=0`
- `tokens_saved` 通常为 12000 到 13000
- `savings_percent` 超过 100%
- transforms 包含 `openai:responses:tool_schema_compaction` 和 `router:openai:responses:function_call_output:*`

例如：

```text
hr_1788313965_000089: original=3, optimized=0, saved=12407
```

正常记录可以和 OpenCode 数据库中的主请求对应。例如：

```text
Headroom optimized = 128483
OpenCode tokens.input + tokens.cache.read = 2019 + 126464 = 128483
```

对应数据库消息为 `msg_05fd1919e0014svEt5OJnuqhdP`。

OpenCode 数据库按逻辑 assistant step 保存消息，而 Headroom 会记录同一 Responses 请求中的多个 HTTP round-trip。因此异常的 `function_call_output` continuation 通常没有独立的 `message` 行，不代表该逻辑请求真的只有 3 个 token。

## 根因

这不是 dashboard HTML 的显示错误。

`/Users/galaxy/.local/pipx/venvs/headroom-ai/lib/python3.14/site-packages/headroom/dashboard/templates/dashboard.html:900-905` 直接显示 `input_tokens_optimized`。

`/Users/galaxy/.local/pipx/venvs/headroom-ai/lib/python3.14/site-packages/headroom/proxy/server.py:4038-4096` 只是把 RequestLog 字段序列化给 dashboard；`/Users/galaxy/.local/pipx/venvs/headroom-ai/lib/python3.14/site-packages/headroom/proxy/outcome.py:497-594` 也只是把 handler 计算出的 token 数写入 RequestLog。

OpenAI Responses HTTP handler 原本只对转换后的 message 列表计数：

1. `function_call_output` continuation 的 messages-only 原始计数可能只有 `3`。
2. Responses 工具 schema/description 压缩节省的 token 来自 `tools` 数组，而不在上述 messages-only 计数中。
3. handler 用 `optimized_tokens = max(0, original_tokens - tokens_saved)` 计算结果。
4. 当工具 schema 节省量大于 messages-only 原始计数时，optimized 被错误截成 `0`，节省率超过 100%。

上游已有完全相同问题的正式 PR：

- PR：[#3106](https://github.com/headroomlabs-ai/headroom/pull/3106)
- 标题：`fix(proxy/openai): keep /v1/responses savings triple coherent when schema savings exceed message tokens`
- 当前状态：`open`，`merged=false`；已有 `JerrettDavis` approve，其他 code owner 仍在等待 review。
- 当前 head commit：`6bcfacc53942dffbfc8f6110fa6ef44a0b3f81d5`

## 本地修复

已修改：

`/Users/galaxy/.local/pipx/venvs/headroom-ai/lib/python3.14/site-packages/headroom/proxy/handlers/openai.py:5582-5916`

修复内容：

- 在压缩前保存 `tools` 原始引用。
- 当 Responses payload 被修改时，将原始工具 schema 的 token 数加入 `original_tokens`。
- 继续用 `original_tokens - tokens_saved` 计算 `optimized_tokens`，保证三者一致。
- 单独保存 messages-only 的 `message_input_tokens`，只把它传给 output shaper，避免改变原有分类。

回归测试结果：

```text
原始异常形态：3 -> 0，saved=5000
修复后：      9034 -> 4034，saved=5000
```

## 运行验证

保留原启动参数和 `HEADROOM_OPENAI_RESPONSES_UPSTREAM_TRANSPORT=http`，重启了 proxy。

重启后的验证结果：

- `/health`：`healthy`，`ready=true`，`version=0.37.0`
- `/dashboard`：HTTP `200`，响应大小 `193614` bytes
- 最近 4 条请求：`zero_input=0`
- 最近 4 条请求：`over_100_percent=0`
- 新请求仍包含 `function_call_output` transform，但 token 统计已正常，例如 `185907 -> 177137`、`saved=8770`。

这个修复只改统计口径，不改变实际发往上游的请求内容。

## 与 `#3379/#3380` 的关系

不能解决本次 `Input=0` 问题。

`#3379/#3380` 是另一个问题：Headroom `0.36+` 在 Anthropic proxy token path 中，后台重新压缩后拒绝 replay 已确认的缓存前缀，导致 prompt cache 反复失效。

该 PR 修改的是：

- `headroom/cache/prefix_tracker.py`
- `headroom/proxy/session_engine.py`
- `headroom/proxy/handlers/anthropic.py`

本次问题发生在：

- OpenAI Responses HTTP path
- `headroom/proxy/handlers/openai.py`
- 工具 schema savings 与 messages-only token denominator 不一致

因此：

- 单独应用 `#3380` 不会修复 `3 -> 0` 或超过 100% 的 dashboard 记录。
- `#3380` 仍然值得应用，因为它修复另一个 Anthropic prompt-cache bust regression。
- 本次问题对应的是 `#3106`，当前本地已移植其核心修复。

### 是否只等待 PR 合并

对本次 `Input=0` 问题，最终等待上游解决的正确条件是：

1. `#3106` 合并到 `headroomlabs-ai/headroom:main`。
2. 包含该合并提交的新 Headroom 版本发布到 PyPI。
3. 本机从 `0.37.0` 升级到该版本，重启 proxy，并验证 `original - optimized == saved` 且 savings 不超过 100%。

因此只等 GitHub PR 显示 merged 还不够；本机正在运行的是 pipx 安装的 `0.37.0`，不会自动获得 main 分支代码。若直接从合并后的 commit 安装，代码层面可以提前解决，但不应把它当作稳定升级路径。

不需要等待 `#3379/#3380` 才升级本次 OpenAI 统计修复；它们与本问题独立。

截至本记录日期，相关进展为：

- `#3379`：open
- `#3380`：open，`mergeable_state=clean`，尚未合并
- `#3106`：open，尚未合并；正式链接为 <https://github.com/headroomlabs-ai/headroom/pull/3106>
- `#2957`：已关闭，修复 PR `#2988` 已于 2026-08-16 合并

## 注意事项

本次修复直接修改 pipx 环境中的 site-package。后续执行 Headroom 升级或重装后，`openai.py` 的本地改动可能被覆盖，需要重新应用。
