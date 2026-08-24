# siliconflow-cn 备用配置

内置 provider `siliconflow-cn` 的连接信息与全量 47 个模型（jsonnet 片段）。
需要恢复全量模型集时，将下方代码块内容替换 `config/opencode.jsonnet` 中的
`local siliconflowModels = { ... }` 即可。

- Display name: SiliconFlow (China)
- 上游 API: https://api.siliconflow.cn/v1
- SDK: @ai-sdk/openai-compatible
- 环境变量: SILICONFLOW_CN_API_KEY
- 生成时间: 2026-08-24，来源: ~/.cache/opencode/models.json（models.dev 注册表缓存）
- 价格为 USD 原价，未做货币换算

当前 opencode.jsonnet 启用 5 款:
- deepseek-ai/DeepSeek-V4-Flash
- deepseek-ai/DeepSeek-V4-Pro
- zai-org/GLM-5.2
- moonshotai/Kimi-K2.7-Code（注册表缓存缺失，规格取自 SiliconFlow 官方模型页）
- Qwen/Qwen3.5-397B-A17B

```jsonnet
// Mirror of the opencode/models.dev registry entry for the built-in
// `siliconflow-cn` provider (generated 2026-08-24 from
// ~/.cache/opencode/models.json). Costs are models.dev USD list prices,
// recorded as published, no currency conversion.
local siliconflowModels = {
  "ByteDance-Seed/Seed-OSS-36B-Instruct": {
    name: "ByteDance-Seed/Seed-OSS-36B-Instruct",
    tool_call: true,
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.21", output: "0.57" },
  },
  "PaddlePaddle/PaddleOCR-VL-1.5": {
    name: "PaddlePaddle/PaddleOCR-VL-1.5",
    tool_call: false,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 16384, output: 16384 },
    cost: { input: "0", output: "0" },
  },
  "Pro/MiniMaxAI/MiniMax-M2.5": {
    name: "Pro/MiniMaxAI/MiniMax-M2.5",
    tool_call: true,
    limit: { context: 192000, output: 131000 },
    cost: { input: "0.3", output: "1.22" },
  },
  "Pro/deepseek-ai/DeepSeek-R1": {
    name: "Pro/deepseek-ai/DeepSeek-R1",
    reasoning: true,
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.5", output: "2.18" },
  },
  "Pro/deepseek-ai/DeepSeek-V3": {
    name: "Pro/deepseek-ai/DeepSeek-V3",
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.25", output: "1" },
  },
  "Pro/deepseek-ai/DeepSeek-V3.1-Terminus": {
    name: "Pro/deepseek-ai/DeepSeek-V3.1-Terminus",
    reasoning: true,
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.27", output: "1" },
  },
  "Pro/deepseek-ai/DeepSeek-V3.2": {
    name: "Pro/deepseek-ai/DeepSeek-V3.2",
    reasoning: true,
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.27", output: "0.42" },
  },
  "Pro/moonshotai/Kimi-K2.5": {
    name: "Pro/moonshotai/Kimi-K2.5",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.45", cache_read: "0.07", output: "2.25" },
  },
  "Pro/moonshotai/Kimi-K2.6": {
    name: "Pro/moonshotai/Kimi-K2.6",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.95", cache_read: "0.16", output: "4" },
  },
  "Pro/zai-org/GLM-5": {
    name: "Pro/zai-org/GLM-5",
    reasoning: true,
    tool_call: true,
    limit: { context: 205000, output: 205000 },
    cost: { input: "1", output: "3.2" },
  },
  "Pro/zai-org/GLM-5.1": {
    name: "Pro/zai-org/GLM-5.1",
    reasoning: true,
    tool_call: true,
    limit: { context: 205000, output: 205000 },
    cost: { input: "1.4", cache_read: "0.26", cache_write: "0", output: "4.4" },
  },
  "Qwen/Qwen2.5-72B-Instruct": {
    name: "Qwen/Qwen2.5-72B-Instruct",
    tool_call: true,
    limit: { context: 33000, output: 4000 },
    cost: { input: "0.59", output: "0.59" },
  },
  "Qwen/Qwen2.5-7B-Instruct": {
    name: "Qwen/Qwen2.5-7B-Instruct",
    tool_call: true,
    limit: { context: 33000, output: 4000 },
    cost: { input: "0.05", output: "0.05" },
  },
  "Qwen/Qwen3-14B": {
    name: "Qwen/Qwen3-14B",
    reasoning: true,
    tool_call: true,
    limit: { context: 131000, output: 131000 },
    cost: { input: "0.07", output: "0.28" },
  },
  "Qwen/Qwen3-235B-A22B-Thinking-2507": {
    name: "Qwen/Qwen3-235B-A22B-Thinking-2507",
    reasoning: true,
    tool_call: true,
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.13", output: "0.6" },
  },
  "Qwen/Qwen3-30B-A3B-Instruct-2507": {
    name: "Qwen/Qwen3-30B-A3B-Instruct-2507",
    tool_call: true,
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.09", output: "0.3" },
  },
  "Qwen/Qwen3-32B": {
    name: "Qwen/Qwen3-32B",
    reasoning: true,
    tool_call: true,
    limit: { context: 131000, output: 131000 },
    cost: { input: "0.14", output: "0.57" },
  },
  "Qwen/Qwen3-8B": {
    name: "Qwen/Qwen3-8B",
    reasoning: true,
    tool_call: true,
    limit: { context: 131000, output: 131000 },
    cost: { input: "0.06", output: "0.06" },
  },
  "Qwen/Qwen3-Coder-30B-A3B-Instruct": {
    name: "Qwen/Qwen3-Coder-30B-A3B-Instruct",
    tool_call: true,
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.07", output: "0.28" },
  },
  "Qwen/Qwen3-Coder-480B-A35B-Instruct": {
    name: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    tool_call: true,
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.25", output: "1" },
  },
  "Qwen/Qwen3-VL-235B-A22B-Instruct": {
    name: "Qwen/Qwen3-VL-235B-A22B-Instruct",
    tool_call: true,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.3", output: "1.5" },
  },
  "Qwen/Qwen3-VL-235B-A22B-Thinking": {
    name: "Qwen/Qwen3-VL-235B-A22B-Thinking",
    reasoning: true,
    tool_call: true,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.45", output: "3.5" },
  },
  "Qwen/Qwen3-VL-30B-A3B-Instruct": {
    name: "Qwen/Qwen3-VL-30B-A3B-Instruct",
    tool_call: true,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.29", output: "1" },
  },
  "Qwen/Qwen3-VL-30B-A3B-Thinking": {
    name: "Qwen/Qwen3-VL-30B-A3B-Thinking",
    reasoning: true,
    tool_call: true,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.29", output: "1" },
  },
  "Qwen/Qwen3-VL-32B-Instruct": {
    name: "Qwen/Qwen3-VL-32B-Instruct",
    tool_call: true,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.2", output: "0.6" },
  },
  "Qwen/Qwen3-VL-32B-Thinking": {
    name: "Qwen/Qwen3-VL-32B-Thinking",
    reasoning: true,
    tool_call: true,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.2", output: "1.5" },
  },
  "Qwen/Qwen3-VL-8B-Instruct": {
    name: "Qwen/Qwen3-VL-8B-Instruct",
    tool_call: true,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.18", output: "0.68" },
  },
  "Qwen/Qwen3.5-122B-A10B": {
    name: "Qwen/Qwen3.5-122B-A10B",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0.29", output: "2.32" },
  },
  "Qwen/Qwen3.5-27B": {
    name: "Qwen/Qwen3.5-27B",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0.26", output: "2.09" },
  },
  "Qwen/Qwen3.5-35B-A3B": {
    name: "Qwen/Qwen3.5-35B-A3B",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0.23", output: "1.86" },
  },
  "Qwen/Qwen3.5-397B-A17B": {
    name: "Qwen/Qwen3.5-397B-A17B",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0.29", output: "1.74" },
  },
  "Qwen/Qwen3.5-4B": {
    name: "Qwen/Qwen3.5-4B",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0", output: "0" },
  },
  "Qwen/Qwen3.5-9B": {
    name: "Qwen/Qwen3.5-9B",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0.22", output: "1.74" },
  },
  "Qwen/Qwen3.6-35B-A3B": {
    name: "Qwen/Qwen3.6-35B-A3B",
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 65536 },
    cost: { input: "0.23", output: "1.86" },
  },
  "baidu/ERNIE-4.5-300B-A47B": {
    name: "baidu/ERNIE-4.5-300B-A47B",
    tool_call: true,
    limit: { context: 131000, output: 131000 },
    cost: { input: "0.28", output: "1.1" },
  },
  "deepseek-ai/DeepSeek-OCR": {
    name: "deepseek-ai/DeepSeek-OCR",
    tool_call: false,
    attachment: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 8192, output: 8192 },
    cost: { input: "0", output: "0" },
  },
  "deepseek-ai/DeepSeek-R1": {
    name: "deepseek-ai/DeepSeek-R1",
    reasoning: true,
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.5", output: "2.18" },
  },
  "deepseek-ai/DeepSeek-V3": {
    name: "deepseek-ai/DeepSeek-V3",
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.25", output: "1" },
  },
  "deepseek-ai/DeepSeek-V3.1-Terminus": {
    name: "deepseek-ai/DeepSeek-V3.1-Terminus",
    reasoning: true,
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.27", output: "1" },
  },
  "deepseek-ai/DeepSeek-V3.2": {
    name: "deepseek-ai/DeepSeek-V3.2",
    reasoning: true,
    tool_call: true,
    limit: { context: 164000, output: 164000 },
    cost: { input: "0.27", output: "0.42" },
  },
  "deepseek-ai/DeepSeek-V4-Flash": {
    name: "DeepSeek V4 Flash",
    reasoning: true,
    tool_call: true,
    limit: { context: 1000000, output: 384000 },
    cost: { input: "0.14", cache_read: "0.003", output: "0.28" },
  },
  "deepseek-ai/DeepSeek-V4-Pro": {
    name: "deepseek-ai/DeepSeek-V4-Pro",
    reasoning: true,
    tool_call: true,
    limit: { context: 1049000, output: 393000 },
    cost: { input: "1.74", cache_read: "0.145", output: "3.48" },
  },
  "inclusionAI/Ling-flash-2.0": {
    name: "inclusionAI/Ling-flash-2.0",
    tool_call: true,
    limit: { context: 131000, output: 131000 },
    cost: { input: "0.14", output: "0.57" },
  },
  "stepfun-ai/Step-3.5-Flash": {
    name: "stepfun-ai/Step-3.5-Flash",
    reasoning: true,
    tool_call: true,
    limit: { context: 262000, output: 262000 },
    cost: { input: "0.1", output: "0.3" },
  },
  "tencent/Hunyuan-A13B-Instruct": {
    name: "tencent/Hunyuan-A13B-Instruct",
    reasoning: true,
    tool_call: true,
    limit: { context: 131000, output: 131000 },
    cost: { input: "0.14", output: "0.57" },
  },
  "zai-org/GLM-4.5-Air": {
    name: "zai-org/GLM-4.5-Air",
    tool_call: true,
    limit: { context: 131000, output: 131000 },
    cost: { input: "0.14", output: "0.86" },
  },
  "zai-org/GLM-5.2": {
    name: "GLM-5.2",
    reasoning: true,
    tool_call: true,
    limit: { context: 1049000, output: 262000 },
    cost: { input: "1.4", cache_read: "0.26", cache_write: "0", output: "4.4" },
  },
};
  "moonshotai/Kimi-K2.7-Code": {
    name: "moonshotai/Kimi-K2.7-Code",
    // NOT in the registry cache; served by the live API. Specs from
    // https://www.siliconflow.com/zh-tw/models/kimi-k2-7-code (2026-08-24).
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 262144, output: 262144 },
    cost: { input: "0.85916", cache_read: "0.17993", output: "3.8" },
  },
}
```
