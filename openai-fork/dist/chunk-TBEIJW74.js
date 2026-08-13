// src/chat/openai-chat-language-model-options.ts
import {
  lazySchema,
  zodSchema
} from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
var openaiLanguageModelChatOptions = lazySchema(
  () => zodSchema(
    z.object({
      /**
       * Modify the likelihood of specified tokens appearing in the completion.
       *
       * Accepts a JSON object that maps tokens (specified by their token ID in
       * the GPT tokenizer) to an associated bias value from -100 to 100.
       */
      logitBias: z.record(z.coerce.number(), z.number()).optional(),
      /**
       * Return the log probabilities of the tokens.
       *
       * Setting to true will return the log probabilities of the tokens that
       * were generated.
       *
       * Setting to a number will return the log probabilities of the top n
       * tokens that were generated.
       */
      logprobs: z.union([z.boolean(), z.number()]).optional(),
      /**
       * Whether to enable parallel function calling during tool use. Default to true.
       */
      parallelToolCalls: z.boolean().optional(),
      /**
       * A unique identifier representing your end-user, which can help OpenAI to
       * monitor and detect abuse.
       */
      user: z.string().optional(),
      /**
       * Reasoning effort for reasoning models. Defaults to `medium`.
       */
      reasoningEffort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).optional(),
      /**
       * Maximum number of completion tokens to generate. Useful for reasoning models.
       */
      maxCompletionTokens: z.number().optional(),
      /**
       * Whether to enable persistence in responses API.
       */
      store: z.boolean().optional(),
      /**
       * Metadata to associate with the request.
       */
      metadata: z.record(z.string().max(64), z.string().max(512)).optional(),
      /**
       * Parameters for prediction mode.
       */
      prediction: z.record(z.string(), z.any()).optional(),
      /**
       * Service tier for the request.
       * - 'auto': Default service tier. The request will be processed with the service tier configured in the
       *           Project settings. Unless otherwise configured, the Project will use 'default'.
       * - 'flex': 50% cheaper processing at the cost of increased latency. Only available for o3 and o4-mini models.
       * - 'priority': Higher-speed processing with predictably low latency at premium cost. Available for Enterprise customers.
       * - 'fast': OpenAI's newer name for the 'priority' tier. Interchangeable with it.
       * - 'default': The request will be processed with the standard pricing and performance for the selected model.
       *
       * @default 'auto'
       */
      serviceTier: z.enum(["auto", "flex", "priority", "fast", "default"]).optional(),
      /**
       * Whether to use strict JSON schema validation.
       *
       * @default true
       */
      strictJsonSchema: z.boolean().optional(),
      /**
       * Controls the verbosity of the model's responses.
       * Lower values will result in more concise responses, while higher values will result in more verbose responses.
       */
      textVerbosity: z.enum(["low", "medium", "high"]).optional(),
      /**
       * A cache key for prompt caching. Allows manual control over prompt caching behavior.
       * Useful for improving cache hit rates and working around automatic caching issues.
       */
      promptCacheKey: z.string().optional(),
      /**
       * Prompt cache behavior for GPT-5.6 and later models.
       * `mode` controls whether OpenAI also places an implicit breakpoint.
       * `ttl` sets the minimum cache lifetime and currently only supports 30 minutes.
       */
      promptCacheOptions: z.object({
        mode: z.enum(["implicit", "explicit"]).optional(),
        ttl: z.literal("30m").optional()
      }).optional(),
      /**
       * The retention policy for the prompt cache.
       * - 'in_memory': Default. Standard prompt caching behavior.
       * - '24h': Extended prompt caching that keeps cached prefixes active for up to 24 hours.
       *          Available for models before GPT-5.6 that support extended caching.
       *
       * @deprecated For GPT-5.6 and later models, use `promptCacheOptions.ttl`.
       *
       * @default 'in_memory'
       */
      promptCacheRetention: z.enum(["in_memory", "24h"]).optional(),
      /**
       * A stable identifier used to help detect users of your application
       * that may be violating OpenAI's usage policies. The IDs should be a
       * string that uniquely identifies each user. We recommend hashing their
       * username or email address, in order to avoid sending us any identifying
       * information.
       */
      safetyIdentifier: z.string().optional(),
      /**
       * Override the system message mode for this model.
       * - 'system': Use the 'system' role for system messages (default for most models)
       * - 'developer': Use the 'developer' role for system messages (used by reasoning models)
       * - 'remove': Remove system messages entirely
       *
       * If not specified, the mode is automatically determined based on the model.
       */
      systemMessageMode: z.enum(["system", "developer", "remove"]).optional(),
      /**
       * Force treating this model as a reasoning model.
       *
       * This is useful for "stealth" reasoning models (e.g. via a custom baseURL)
       * where the model ID is not recognized by the SDK's allowlist.
       *
       * When enabled, the SDK applies reasoning-model parameter compatibility rules
       * and defaults `systemMessageMode` to `developer` unless overridden.
       */
      forceReasoning: z.boolean().optional()
    })
  )
);

// src/chat/openai-chat-language-model.ts
import {
  StreamingToolCallTracker,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isCustomReasoning,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE
} from "@ai-sdk/provider-utils";

// src/openai-error.ts
import { z as z2 } from "zod/v4";
import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
var openaiErrorDataSchema = z2.object({
  error: z2.object({
    message: z2.string(),
    // The additional information below is handled loosely to support
    // OpenAI-compatible providers that have slightly different error
    // responses:
    type: z2.string().nullish(),
    param: z2.any().nullish(),
    code: z2.union([z2.string(), z2.number()]).nullish()
  })
});
var openaiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: openaiErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/openai-language-model-capabilities.ts
function getOpenAILanguageModelCapabilities(modelId) {
  const oSeriesVersion = getOSeriesVersion(modelId);
  const gptVersion = getGptVersion(modelId);
  const isGptChatModel = gptVersion?.minor == null && (gptVersion?.variant?.startsWith("chat") ?? false);
  const isGptNanoModel = gptVersion?.variant?.startsWith("nano") ?? false;
  const supportsFlexProcessing = oSeriesVersion != null && oSeriesVersion >= 3 || gptVersion != null && gptVersion.major >= 5 && !isGptChatModel;
  const supportsPriorityProcessing = modelId.startsWith("gpt-4") || gptVersion != null && gptVersion.major >= 5 && !isGptNanoModel && !isGptChatModel || oSeriesVersion != null && oSeriesVersion >= 3;
  const isReasoningModel = oSeriesVersion != null || gptVersion != null && gptVersion.major >= 5 && !isGptChatModel;
  const supportsNonReasoningParameters = gptVersion != null && (gptVersion.major > 5 || gptVersion.major === 5 && (gptVersion.minor ?? 0) >= 1);
  const systemMessageMode = isReasoningModel ? "developer" : "system";
  return {
    supportsFlexProcessing,
    supportsPriorityProcessing,
    isReasoningModel,
    systemMessageMode,
    supportsNonReasoningParameters
  };
}
function getOSeriesVersion(modelId) {
  const match = /^o(\d+)(?:-|$)/.exec(modelId);
  return match == null ? void 0 : Number(match[1]);
}
function getGptVersion(modelId) {
  const match = /^gpt-(\d+)(?:\.(\d+))?(?:-(.+))?$/.exec(modelId);
  if (match == null) {
    return void 0;
  }
  return {
    major: Number(match[1]),
    minor: match[2] == null ? void 0 : Number(match[2]),
    variant: match[3]
  };
}

// src/openai-stream-error.ts
import { APICallError } from "@ai-sdk/provider";
async function throwIfOpenAIStreamErrorBeforeOutput({
  stream,
  getError,
  isOutputChunk,
  isAcceptedChunk,
  acceptedGraceMs = 50,
  url,
  requestBodyValues,
  responseHeaders
}) {
  const [streamForEarlyError, streamForConsumer] = stream.tee();
  const reader = streamForEarlyError.getReader();
  let drainAfterError = false;
  try {
    let accepted = false;
    while (true) {
      let result;
      if (accepted) {
        const raced = await raceWithTimeout(reader.read(), acceptedGraceMs);
        if (raced.timedOut) {
          return streamForConsumer;
        }
        result = raced.value;
      } else {
        result = await reader.read();
      }
      if (result.done) {
        return streamForConsumer;
      }
      const chunk = result.value;
      if (!chunk.success) {
        return streamForConsumer;
      }
      const errorFrame = getError(chunk.value);
      if (errorFrame != null) {
        drainAfterError = true;
        drainReader(reader).catch(() => {
        });
        drainReader(streamForConsumer.getReader()).catch(() => {
        });
        throw createOpenAIStreamError({
          frame: errorFrame,
          url,
          requestBodyValues,
          responseHeaders
        });
      }
      if (isOutputChunk(chunk.value)) {
        return streamForConsumer;
      }
      if (!accepted && isAcceptedChunk?.(chunk.value) === true) {
        accepted = true;
      }
    }
  } finally {
    if (!drainAfterError) {
      reader.cancel().catch(() => {
      });
      reader.releaseLock();
    }
  }
}
async function drainReader(reader) {
  try {
    while (!(await reader.read()).done) {
    }
  } catch {
  } finally {
    reader.releaseLock();
  }
}
async function raceWithTimeout(promise, timeoutMs) {
  let timer;
  const wrapped = promise.then((value) => ({ timedOut: false, value }));
  try {
    const raced = await Promise.race([
      wrapped,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
      })
    ]);
    if (raced.timedOut) {
      wrapped.catch(() => {
      });
    }
    return raced;
  } finally {
    clearTimeout(timer);
  }
}
function createOpenAIStreamError({
  frame,
  url,
  requestBodyValues,
  responseHeaders
}) {
  const streamError = parseStreamError(frame);
  return new APICallError({
    message: streamError?.message ?? "OpenAI stream failed before any output was generated",
    url,
    requestBodyValues,
    statusCode: streamError == null ? 500 : getStatusCode(streamError),
    responseHeaders,
    responseBody: JSON.stringify(frame),
    data: frame
  });
}
function parseStreamError(frame) {
  const value = asRecord(frame);
  if (value == null) {
    return void 0;
  }
  if (value.type === "response.failed") {
    const response = asRecord(value.response);
    const responseError = asRecord(response?.error);
    return typeof responseError?.message === "string" ? {
      message: responseError.message,
      code: getStringOrNumber(responseError.code),
      type: "response.failed",
      frame
    } : void 0;
  }
  const error = asRecord(value.error) ?? value;
  return typeof error.message === "string" && (asRecord(value.error) != null || typeof error.type === "string" || "code" in error || "param" in error) ? {
    message: error.message,
    code: getStringOrNumber(error.code),
    type: typeof error.type === "string" ? error.type : void 0,
    frame
  } : void 0;
}
function getStatusCode(error) {
  if (typeof error.code === "number" && isHttpErrorStatusCode(error.code)) {
    return error.code;
  }
  if (typeof error.code === "string" && /^\d{3}$/.test(error.code)) {
    const numericCode = Number(error.code);
    if (isHttpErrorStatusCode(numericCode)) {
      return numericCode;
    }
  }
  const discriminator = [error.code, error.type].filter((value) => typeof value === "string" || typeof value === "number").join(" ").toLowerCase();
  if (["insufficient_quota", "rate_limit"].some(
    (term) => discriminator.includes(term)
  )) {
    return 429;
  }
  if (discriminator.includes("authentication")) return 401;
  if (discriminator.includes("permission")) return 403;
  if (discriminator.includes("not_found")) return 404;
  if (["invalid", "bad_request", "context_length"].some(
    (term) => discriminator.includes(term)
  )) {
    return 400;
  }
  if (discriminator.includes("overload")) return 503;
  if (discriminator.includes("timeout")) return 504;
  return 500;
}
function asRecord(value) {
  return typeof value === "object" && value != null ? value : void 0;
}
function getStringOrNumber(value) {
  return typeof value === "string" || typeof value === "number" ? value : void 0;
}
function isHttpErrorStatusCode(value) {
  return Number.isInteger(value) && value >= 400 && value <= 599;
}

// src/chat/convert-openai-chat-usage.ts
import { createNullLanguageModelUsage } from "@ai-sdk/provider-utils";
function convertOpenAIChatUsage(usage) {
  if (usage == null) {
    return createNullLanguageModelUsage();
  }
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const cacheWriteTokens = usage.prompt_tokens_details?.cache_write_tokens ?? void 0;
  const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;
  return {
    inputTokens: {
      total: promptTokens,
      noCache: promptTokens - cachedTokens - (cacheWriteTokens ?? 0),
      cacheRead: cachedTokens,
      cacheWrite: cacheWriteTokens
    },
    outputTokens: {
      total: completionTokens,
      text: completionTokens - reasoningTokens,
      reasoning: reasoningTokens
    },
    raw: usage
  };
}

// src/chat/convert-to-openai-chat-messages.ts
import {
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import {
  convertToBase64,
  getTopLevelMediaType,
  resolveFullMediaType,
  resolveProviderReference
} from "@ai-sdk/provider-utils";
function serializeToolCallArguments(input) {
  return JSON.stringify(input === void 0 ? {} : input);
}
function getPromptCacheBreakpoint(providerOptions) {
  return providerOptions?.openai?.promptCacheBreakpoint;
}
function convertToOpenAIChatMessages({
  prompt,
  systemMessageMode = "system"
}) {
  const messages = [];
  const warnings = [];
  for (const { role, content, providerOptions } of prompt) {
    switch (role) {
      case "system": {
        switch (systemMessageMode) {
          case "system": {
            const promptCacheBreakpoint = getPromptCacheBreakpoint(providerOptions);
            messages.push({
              role: "system",
              content: promptCacheBreakpoint == null ? content : [
                {
                  type: "text",
                  text: content,
                  prompt_cache_breakpoint: promptCacheBreakpoint
                }
              ]
            });
            break;
          }
          case "developer": {
            const promptCacheBreakpoint = getPromptCacheBreakpoint(providerOptions);
            messages.push({
              role: "developer",
              content: promptCacheBreakpoint == null ? content : [
                {
                  type: "text",
                  text: content,
                  prompt_cache_breakpoint: promptCacheBreakpoint
                }
              ]
            });
            break;
          }
          case "remove": {
            warnings.push({
              type: "other",
              message: "system messages are removed for this model"
            });
            break;
          }
          default: {
            const _exhaustiveCheck = systemMessageMode;
            throw new Error(
              `Unsupported system message mode: ${_exhaustiveCheck}`
            );
          }
        }
        break;
      }
      case "user": {
        if (content.length === 1 && content[0].type === "text" && getPromptCacheBreakpoint(content[0].providerOptions) == null) {
          messages.push({ role: "user", content: content[0].text });
          break;
        }
        messages.push({
          role: "user",
          content: content.map((part, index) => {
            switch (part.type) {
              case "text": {
                const promptCacheBreakpoint = getPromptCacheBreakpoint(
                  part.providerOptions
                );
                return {
                  type: "text",
                  text: part.text,
                  ...promptCacheBreakpoint != null && {
                    prompt_cache_breakpoint: promptCacheBreakpoint
                  }
                };
              }
              case "file": {
                const promptCacheBreakpoint = getPromptCacheBreakpoint(
                  part.providerOptions
                );
                switch (part.data.type) {
                  case "reference": {
                    return {
                      type: "file",
                      file: {
                        file_id: resolveProviderReference({
                          reference: part.data.reference,
                          provider: "openai"
                        })
                      },
                      ...promptCacheBreakpoint != null && {
                        prompt_cache_breakpoint: promptCacheBreakpoint
                      }
                    };
                  }
                  case "text": {
                    throw new UnsupportedFunctionalityError({
                      functionality: "text file parts"
                    });
                  }
                  case "url":
                  case "data": {
                    const topLevel = getTopLevelMediaType(part.mediaType);
                    if (topLevel === "image") {
                      return {
                        type: "image_url",
                        image_url: {
                          url: part.data.type === "url" ? part.data.url.toString() : `data:${resolveFullMediaType({ part })};base64,${convertToBase64(part.data.data)}`,
                          detail: part.providerOptions?.openai?.imageDetail
                        },
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    } else if (topLevel === "audio") {
                      if (part.data.type === "url") {
                        throw new UnsupportedFunctionalityError({
                          functionality: "audio file parts with URLs"
                        });
                      }
                      const fullMediaType = resolveFullMediaType({ part });
                      switch (fullMediaType) {
                        case "audio/wav": {
                          return {
                            type: "input_audio",
                            input_audio: {
                              data: convertToBase64(part.data.data),
                              format: "wav"
                            },
                            ...promptCacheBreakpoint != null && {
                              prompt_cache_breakpoint: promptCacheBreakpoint
                            }
                          };
                        }
                        case "audio/mp3":
                        case "audio/mpeg": {
                          return {
                            type: "input_audio",
                            input_audio: {
                              data: convertToBase64(part.data.data),
                              format: "mp3"
                            },
                            ...promptCacheBreakpoint != null && {
                              prompt_cache_breakpoint: promptCacheBreakpoint
                            }
                          };
                        }
                        default: {
                          throw new UnsupportedFunctionalityError({
                            functionality: `audio content parts with media type ${fullMediaType}`
                          });
                        }
                      }
                    }
                    {
                      const fullMediaType = resolveFullMediaType({ part });
                      if (fullMediaType !== "application/pdf") {
                        throw new UnsupportedFunctionalityError({
                          functionality: `file part media type ${fullMediaType}`
                        });
                      }
                      if (part.data.type === "url") {
                        throw new UnsupportedFunctionalityError({
                          functionality: "PDF file parts with URLs"
                        });
                      }
                      return {
                        type: "file",
                        file: {
                          filename: part.filename ?? `part-${index}.pdf`,
                          file_data: `data:application/pdf;base64,${convertToBase64(part.data.data)}`
                        },
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    }
                  }
                }
              }
            }
          })
        });
        break;
      }
      case "assistant": {
        let text = "";
        const textParts = [];
        let hasPromptCacheBreakpoint = false;
        const toolCalls = [];
        for (const part of content) {
          switch (part.type) {
            case "text": {
              const promptCacheBreakpoint = getPromptCacheBreakpoint(
                part.providerOptions
              );
              text += part.text;
              textParts.push({
                type: "text",
                text: part.text,
                ...promptCacheBreakpoint != null && {
                  prompt_cache_breakpoint: promptCacheBreakpoint
                }
              });
              hasPromptCacheBreakpoint ||= promptCacheBreakpoint != null;
              break;
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: serializeToolCallArguments(part.input)
                }
              });
              break;
            }
          }
        }
        messages.push({
          role: "assistant",
          content: hasPromptCacheBreakpoint ? textParts : toolCalls.length > 0 ? text || null : text,
          tool_calls: toolCalls.length > 0 ? toolCalls : void 0
        });
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          if (toolResponse.type === "tool-approval-response") {
            continue;
          }
          const output = toolResponse.output;
          const promptCacheBreakpoint = (output.type === "content" ? output.value.map((part) => getPromptCacheBreakpoint(part.providerOptions)).find((breakpoint) => breakpoint != null) : getPromptCacheBreakpoint(output.providerOptions)) ?? getPromptCacheBreakpoint(toolResponse.providerOptions);
          let contentValue;
          switch (output.type) {
            case "text":
            case "error-text":
              contentValue = output.value;
              break;
            case "execution-denied":
              contentValue = output.reason ?? "Tool call execution denied.";
              break;
            case "content":
            case "json":
            case "error-json":
              contentValue = JSON.stringify(output.value);
              break;
          }
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: promptCacheBreakpoint == null ? contentValue : [
              {
                type: "text",
                text: contentValue,
                prompt_cache_breakpoint: promptCacheBreakpoint
              }
            ]
          });
        }
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  return { messages, warnings };
}

// src/chat/get-response-metadata.ts
import { createLanguageModelResponseMetadata } from "@ai-sdk/provider-utils";
function getResponseMetadata({
  id,
  model,
  created
}) {
  return createLanguageModelResponseMetadata({
    id,
    model,
    // Azure content-filter chunks use 0 as a placeholder timestamp. Preserve
    // the previous OpenAI behavior so those chunks are not treated as metadata.
    created: created || void 0
  });
}

// src/chat/map-openai-finish-reason.ts
function mapOpenAIFinishReason(finishReason) {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    case "function_call":
    case "tool_calls":
      return "tool-calls";
    default:
      return "other";
  }
}

// src/chat/openai-chat-api.ts
import {
  lazySchema as lazySchema2,
  zodSchema as zodSchema2
} from "@ai-sdk/provider-utils";
import { z as z3 } from "zod/v4";
var openaiChatResponseSchema = lazySchema2(
  () => zodSchema2(
    z3.object({
      id: z3.string().nullish(),
      created: z3.number().nullish(),
      model: z3.string().nullish(),
      choices: z3.array(
        z3.object({
          message: z3.object({
            role: z3.literal("assistant").nullish(),
            content: z3.string().nullish(),
            tool_calls: z3.array(
              z3.object({
                id: z3.string().nullish(),
                type: z3.literal("function"),
                function: z3.object({
                  name: z3.string(),
                  arguments: z3.string()
                })
              })
            ).nullish(),
            annotations: z3.array(
              z3.object({
                type: z3.literal("url_citation"),
                url_citation: z3.object({
                  start_index: z3.number(),
                  end_index: z3.number(),
                  url: z3.string(),
                  title: z3.string()
                })
              })
            ).nullish()
          }),
          index: z3.number(),
          logprobs: z3.object({
            content: z3.array(
              z3.object({
                token: z3.string(),
                logprob: z3.number(),
                top_logprobs: z3.array(
                  z3.object({
                    token: z3.string(),
                    logprob: z3.number()
                  })
                )
              })
            ).nullish()
          }).nullish(),
          finish_reason: z3.string().nullish()
        })
      ),
      usage: z3.object({
        prompt_tokens: z3.number().nullish(),
        completion_tokens: z3.number().nullish(),
        total_tokens: z3.number().nullish(),
        prompt_tokens_details: z3.object({
          cached_tokens: z3.number().nullish(),
          cache_write_tokens: z3.number().nullish()
        }).nullish(),
        completion_tokens_details: z3.object({
          reasoning_tokens: z3.number().nullish(),
          accepted_prediction_tokens: z3.number().nullish(),
          rejected_prediction_tokens: z3.number().nullish()
        }).nullish()
      }).nullish()
    })
  )
);
var openaiChatChunkSchema = lazySchema2(
  () => zodSchema2(
    z3.union([
      z3.object({
        id: z3.string().nullish(),
        created: z3.number().nullish(),
        model: z3.string().nullish(),
        choices: z3.array(
          z3.object({
            delta: z3.object({
              role: z3.enum(["assistant"]).nullish(),
              content: z3.string().nullish(),
              tool_calls: z3.array(
                z3.object({
                  index: z3.number(),
                  id: z3.string().nullish(),
                  type: z3.literal("function").nullish(),
                  function: z3.object({
                    name: z3.string().nullish(),
                    arguments: z3.string().nullish()
                  })
                })
              ).nullish(),
              annotations: z3.array(
                z3.object({
                  type: z3.literal("url_citation"),
                  url_citation: z3.object({
                    start_index: z3.number(),
                    end_index: z3.number(),
                    url: z3.string(),
                    title: z3.string()
                  })
                })
              ).nullish()
            }).nullish(),
            logprobs: z3.object({
              content: z3.array(
                z3.object({
                  token: z3.string(),
                  logprob: z3.number(),
                  top_logprobs: z3.array(
                    z3.object({
                      token: z3.string(),
                      logprob: z3.number()
                    })
                  )
                })
              ).nullish()
            }).nullish(),
            finish_reason: z3.string().nullish(),
            index: z3.number()
          })
        ),
        usage: z3.object({
          prompt_tokens: z3.number().nullish(),
          completion_tokens: z3.number().nullish(),
          total_tokens: z3.number().nullish(),
          prompt_tokens_details: z3.object({
            cached_tokens: z3.number().nullish(),
            cache_write_tokens: z3.number().nullish()
          }).nullish(),
          completion_tokens_details: z3.object({
            reasoning_tokens: z3.number().nullish(),
            accepted_prediction_tokens: z3.number().nullish(),
            rejected_prediction_tokens: z3.number().nullish()
          }).nullish()
        }).nullish()
      }),
      openaiErrorDataSchema
    ])
  )
);

// src/chat/openai-chat-prepare-tools.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";
function prepareChatTools({
  tools,
  toolChoice
}) {
  tools = tools?.length ? tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, toolChoice: void 0, toolWarnings };
  }
  const openaiTools = [];
  for (const tool of tools) {
    switch (tool.type) {
      case "function":
        openaiTools.push({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
            ...tool.strict != null ? { strict: tool.strict } : {}
          }
        });
        break;
      default:
        toolWarnings.push({
          type: "unsupported",
          feature: `tool type: ${tool.type}`
        });
        break;
    }
  }
  if (toolChoice == null) {
    return { tools: openaiTools, toolChoice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiTools, toolChoice: type, toolWarnings };
    case "tool":
      return {
        tools: openaiTools,
        toolChoice: {
          type: "function",
          function: {
            name: toolChoice.toolName
          }
        },
        toolWarnings
      };
    default: {
      const _exhaustiveCheck = type;
      throw new UnsupportedFunctionalityError2({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/chat/openai-chat-language-model.ts
var OpenAIChatLanguageModel = class _OpenAIChatLanguageModel {
  specificationVersion = "v4";
  modelId;
  supportedUrls = {
    "image/*": [/^https?:\/\/.*$/]
  };
  config;
  static [WORKFLOW_SERIALIZE](model) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE](options) {
    return new _OpenAIChatLanguageModel(options.modelId, options.config);
  }
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    tools,
    toolChoice,
    reasoning,
    providerOptions
  }) {
    const warnings = [];
    const openaiOptions = await parseProviderOptions({
      provider: "openai",
      providerOptions,
      schema: openaiLanguageModelChatOptions
    }) ?? {};
    const modelCapabilities = getOpenAILanguageModelCapabilities(this.modelId);
    const resolvedReasoningEffort = openaiOptions.reasoningEffort ?? (isCustomReasoning(reasoning) ? reasoning : void 0);
    const isReasoningModel = openaiOptions.forceReasoning ?? modelCapabilities.isReasoningModel;
    if (topK != null) {
      warnings.push({ type: "unsupported", feature: "topK" });
    }
    const { messages, warnings: messageWarnings } = convertToOpenAIChatMessages(
      {
        prompt,
        systemMessageMode: openaiOptions.systemMessageMode ?? (isReasoningModel ? "developer" : modelCapabilities.systemMessageMode)
      }
    );
    warnings.push(...messageWarnings);
    const strictJsonSchema = openaiOptions.strictJsonSchema ?? true;
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      logit_bias: openaiOptions.logitBias,
      logprobs: openaiOptions.logprobs === true || typeof openaiOptions.logprobs === "number" ? true : void 0,
      top_logprobs: typeof openaiOptions.logprobs === "number" ? openaiOptions.logprobs : typeof openaiOptions.logprobs === "boolean" ? openaiOptions.logprobs ? 0 : void 0 : void 0,
      user: openaiOptions.user,
      parallel_tool_calls: openaiOptions.parallelToolCalls,
      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format: responseFormat?.type === "json" ? responseFormat.schema != null ? {
        type: "json_schema",
        json_schema: {
          schema: responseFormat.schema,
          strict: strictJsonSchema,
          name: responseFormat.name ?? "response",
          description: responseFormat.description
        }
      } : { type: "json_object" } : void 0,
      stop: stopSequences,
      seed,
      verbosity: openaiOptions.textVerbosity,
      // openai specific settings:
      // TODO AI SDK 6: remove, we auto-map maxOutputTokens now
      max_completion_tokens: openaiOptions.maxCompletionTokens,
      store: openaiOptions.store,
      metadata: openaiOptions.metadata,
      prediction: openaiOptions.prediction,
      reasoning_effort: resolvedReasoningEffort,
      service_tier: openaiOptions.serviceTier,
      prompt_cache_key: openaiOptions.promptCacheKey,
      prompt_cache_options: openaiOptions.promptCacheOptions,
      prompt_cache_retention: openaiOptions.promptCacheRetention,
      safety_identifier: openaiOptions.safetyIdentifier,
      // messages:
      messages
    };
    if (isReasoningModel) {
      if (resolvedReasoningEffort !== "none" || !modelCapabilities.supportsNonReasoningParameters) {
        if (baseArgs.temperature != null) {
          baseArgs.temperature = void 0;
          warnings.push({
            type: "unsupported",
            feature: "temperature",
            details: "temperature is not supported for reasoning models"
          });
        }
        if (baseArgs.top_p != null) {
          baseArgs.top_p = void 0;
          warnings.push({
            type: "unsupported",
            feature: "topP",
            details: "topP is not supported for reasoning models"
          });
        }
        if (baseArgs.logprobs != null) {
          baseArgs.logprobs = void 0;
          warnings.push({
            type: "other",
            message: "logprobs is not supported for reasoning models"
          });
        }
      }
      if (baseArgs.frequency_penalty != null) {
        baseArgs.frequency_penalty = void 0;
        warnings.push({
          type: "unsupported",
          feature: "frequencyPenalty",
          details: "frequencyPenalty is not supported for reasoning models"
        });
      }
      if (baseArgs.presence_penalty != null) {
        baseArgs.presence_penalty = void 0;
        warnings.push({
          type: "unsupported",
          feature: "presencePenalty",
          details: "presencePenalty is not supported for reasoning models"
        });
      }
      if (baseArgs.logit_bias != null) {
        baseArgs.logit_bias = void 0;
        warnings.push({
          type: "other",
          message: "logitBias is not supported for reasoning models"
        });
      }
      if (baseArgs.top_logprobs != null) {
        baseArgs.top_logprobs = void 0;
        warnings.push({
          type: "other",
          message: "topLogprobs is not supported for reasoning models"
        });
      }
      if (baseArgs.max_tokens != null) {
        if (baseArgs.max_completion_tokens == null) {
          baseArgs.max_completion_tokens = baseArgs.max_tokens;
        }
        baseArgs.max_tokens = void 0;
      }
    } else if (this.modelId.startsWith("gpt-4o-search-preview") || this.modelId.startsWith("gpt-4o-mini-search-preview")) {
      if (baseArgs.temperature != null) {
        baseArgs.temperature = void 0;
        warnings.push({
          type: "unsupported",
          feature: "temperature",
          details: "temperature is not supported for the search preview models and has been removed."
        });
      }
    }
    if (openaiOptions.serviceTier === "flex" && !modelCapabilities.supportsFlexProcessing) {
      warnings.push({
        type: "unsupported",
        feature: "serviceTier",
        details: "flex processing is only available for o3, o4-mini, and gpt-5 models"
      });
      baseArgs.service_tier = void 0;
    }
    if ((openaiOptions.serviceTier === "priority" || openaiOptions.serviceTier === "fast") && !modelCapabilities.supportsPriorityProcessing) {
      warnings.push({
        type: "unsupported",
        feature: "serviceTier",
        details: "priority processing is only available for supported models (gpt-4, gpt-5, gpt-5-mini, o3, o4-mini) and requires Enterprise access. gpt-5-nano is not supported"
      });
      baseArgs.service_tier = void 0;
    }
    const {
      tools: openaiTools,
      toolChoice: openaiToolChoice,
      toolWarnings
    } = prepareChatTools({
      tools,
      toolChoice
    });
    return {
      args: {
        ...baseArgs,
        tools: openaiTools,
        tool_choice: openaiToolChoice
      },
      warnings: [...warnings, ...toolWarnings]
    };
  }
  async doGenerate(options) {
    const { args: body, warnings } = await this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const choice = response.choices[0];
    const content = [];
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: "text", text });
    }
    for (const toolCall of choice.message.tool_calls ?? []) {
      content.push({
        type: "tool-call",
        toolCallId: toolCall.id ?? generateId(),
        toolName: toolCall.function.name,
        input: toolCall.function.arguments
      });
    }
    for (const annotation of choice.message.annotations ?? []) {
      content.push({
        type: "source",
        sourceType: "url",
        id: generateId(),
        url: annotation.url_citation.url,
        title: annotation.url_citation.title
      });
    }
    const completionTokenDetails = response.usage?.completion_tokens_details;
    const providerMetadata = { openai: {} };
    if (completionTokenDetails?.accepted_prediction_tokens != null) {
      providerMetadata.openai.acceptedPredictionTokens = completionTokenDetails?.accepted_prediction_tokens;
    }
    if (completionTokenDetails?.rejected_prediction_tokens != null) {
      providerMetadata.openai.rejectedPredictionTokens = completionTokenDetails?.rejected_prediction_tokens;
    }
    if (choice.logprobs?.content != null) {
      providerMetadata.openai.logprobs = choice.logprobs.content;
    }
    return {
      content,
      finishReason: {
        unified: mapOpenAIFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? void 0
      },
      usage: convertOpenAIChatUsage(response.usage),
      request: { body },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse
      },
      warnings,
      providerMetadata
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };
    const url = this.config.url({
      path: "/chat/completions",
      modelId: this.modelId
    });
    const { responseHeaders, value: response } = await postJsonToApi({
      url,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        openaiChatChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const checkedResponse = await throwIfOpenAIStreamErrorBeforeOutput({
      stream: response,
      getError: (chunk) => "error" in chunk ? chunk.error : void 0,
      isOutputChunk: isOpenAIChatOutputChunk,
      url,
      requestBodyValues: body,
      responseHeaders
    });
    let toolCallTracker;
    let finishReason = {
      unified: "other",
      raw: void 0
    };
    let usage = void 0;
    let metadataExtracted = false;
    let isActiveText = false;
    const providerMetadata = { openai: {} };
    const result = {
      stream: checkedResponse.pipeThrough(
        new TransformStream({
          start(controller) {
            toolCallTracker = new StreamingToolCallTracker(controller, {
              generateId,
              typeValidation: "if-present"
            });
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
            if (!chunk.success) {
              finishReason = { unified: "error", raw: void 0 };
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if ("error" in value) {
              finishReason = { unified: "error", raw: void 0 };
              controller.enqueue({ type: "error", error: value.error });
              return;
            }
            if (!metadataExtracted) {
              const metadata = getResponseMetadata(value);
              if (Object.values(metadata).some(Boolean)) {
                metadataExtracted = true;
                controller.enqueue({
                  type: "response-metadata",
                  ...getResponseMetadata(value)
                });
              }
            }
            if (value.usage != null) {
              usage = value.usage;
              if (value.usage.completion_tokens_details?.accepted_prediction_tokens != null) {
                providerMetadata.openai.acceptedPredictionTokens = value.usage.completion_tokens_details?.accepted_prediction_tokens;
              }
              if (value.usage.completion_tokens_details?.rejected_prediction_tokens != null) {
                providerMetadata.openai.rejectedPredictionTokens = value.usage.completion_tokens_details?.rejected_prediction_tokens;
              }
            }
            const choice = value.choices[0];
            if (choice?.finish_reason != null) {
              finishReason = {
                unified: mapOpenAIFinishReason(choice.finish_reason),
                raw: choice.finish_reason
              };
            }
            if (choice?.logprobs?.content != null) {
              providerMetadata.openai.logprobs = choice.logprobs.content;
            }
            if (choice?.delta == null) {
              return;
            }
            const delta = choice.delta;
            if (delta.content != null) {
              if (!isActiveText) {
                controller.enqueue({ type: "text-start", id: "0" });
                isActiveText = true;
              }
              controller.enqueue({
                type: "text-delta",
                id: "0",
                delta: delta.content
              });
            }
            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                toolCallTracker.processDelta(toolCallDelta);
              }
            }
            if (delta.annotations != null) {
              for (const annotation of delta.annotations) {
                controller.enqueue({
                  type: "source",
                  sourceType: "url",
                  id: generateId(),
                  url: annotation.url_citation.url,
                  title: annotation.url_citation.title
                });
              }
            }
          },
          flush(controller) {
            if (isActiveText) {
              controller.enqueue({ type: "text-end", id: "0" });
            }
            toolCallTracker.flush();
            controller.enqueue({
              type: "finish",
              finishReason,
              usage: convertOpenAIChatUsage(usage),
              ...providerMetadata != null ? { providerMetadata } : {}
            });
          }
        })
      ),
      request: { body },
      response: { headers: responseHeaders }
    };
    return result;
  }
};
function isOpenAIChatOutputChunk(chunk) {
  if ("error" in chunk) {
    return false;
  }
  return chunk.choices.some((choice) => {
    const delta = choice.delta;
    return delta?.content != null && delta.content.length > 0 || delta?.tool_calls != null && delta.tool_calls.length > 0 || delta?.annotations != null && delta.annotations.length > 0;
  });
}

// src/completion/openai-completion-language-model-options.ts
import {
  lazySchema as lazySchema3,
  zodSchema as zodSchema3
} from "@ai-sdk/provider-utils";
import { z as z4 } from "zod/v4";
var openaiLanguageModelCompletionOptions = lazySchema3(
  () => zodSchema3(
    z4.object({
      /**
       * Echo back the prompt in addition to the completion.
       */
      echo: z4.boolean().optional(),
      /**
       * Modify the likelihood of specified tokens appearing in the completion.
       *
       * Accepts a JSON object that maps tokens (specified by their token ID in
       * the GPT tokenizer) to an associated bias value from -100 to 100. You
       * can use this tokenizer tool to convert text to token IDs. Mathematically,
       * the bias is added to the logits generated by the model prior to sampling.
       * The exact effect will vary per model, but values between -1 and 1 should
       * decrease or increase likelihood of selection; values like -100 or 100
       * should result in a ban or exclusive selection of the relevant token.
       *
       * As an example, you can pass {"50256": -100} to prevent the <|endoftext|>
       * token from being generated.
       */
      logitBias: z4.record(z4.string(), z4.number()).optional(),
      /**
       * The suffix that comes after a completion of inserted text.
       */
      suffix: z4.string().optional(),
      /**
       * A unique identifier representing your end-user, which can help OpenAI to
       * monitor and detect abuse. Learn more.
       */
      user: z4.string().optional(),
      /**
       * Return the log probabilities of the tokens. Including logprobs will increase
       * the response size and can slow down response times. However, it can
       * be useful to better understand how the model is behaving.
       * Setting to true will return the log probabilities of the tokens that
       * were generated.
       * Setting to a number will return the log probabilities of the top n
       * tokens that were generated.
       */
      logprobs: z4.union([z4.boolean(), z4.number()]).optional()
    })
  )
);

// src/completion/openai-completion-language-model.ts
import {
  combineHeaders as combineHeaders2,
  createEventSourceResponseHandler as createEventSourceResponseHandler2,
  createJsonResponseHandler as createJsonResponseHandler2,
  parseProviderOptions as parseProviderOptions2,
  postJsonToApi as postJsonToApi2,
  serializeModelOptions as serializeModelOptions2,
  WORKFLOW_DESERIALIZE as WORKFLOW_DESERIALIZE2,
  WORKFLOW_SERIALIZE as WORKFLOW_SERIALIZE2
} from "@ai-sdk/provider-utils";

// src/completion/convert-openai-completion-usage.ts
import { createNullLanguageModelUsage as createNullLanguageModelUsage2 } from "@ai-sdk/provider-utils";
function convertOpenAICompletionUsage(usage) {
  if (usage == null) {
    return createNullLanguageModelUsage2();
  }
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  return {
    inputTokens: {
      total: usage.prompt_tokens ?? void 0,
      noCache: promptTokens,
      cacheRead: void 0,
      cacheWrite: void 0
    },
    outputTokens: {
      total: usage.completion_tokens ?? void 0,
      text: completionTokens,
      reasoning: void 0
    },
    raw: usage
  };
}

// src/completion/convert-to-openai-completion-prompt.ts
import {
  InvalidPromptError,
  UnsupportedFunctionalityError as UnsupportedFunctionalityError3
} from "@ai-sdk/provider";
function convertToOpenAICompletionPrompt({
  prompt,
  user = "user",
  assistant = "assistant"
}) {
  let text = "";
  if (prompt[0].role === "system") {
    text += `${prompt[0].content}

`;
    prompt = prompt.slice(1);
  }
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        throw new InvalidPromptError({
          message: "Unexpected system message in prompt: ${content}",
          prompt
        });
      }
      case "user": {
        const userMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
          }
        }).filter(Boolean).join("");
        text += `${user}:
${userMessage}

`;
        break;
      }
      case "assistant": {
        const assistantMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
            case "tool-call": {
              throw new UnsupportedFunctionalityError3({
                functionality: "tool-call messages"
              });
            }
          }
        }).join("");
        text += `${assistant}:
${assistantMessage}

`;
        break;
      }
      case "tool": {
        throw new UnsupportedFunctionalityError3({
          functionality: "tool messages"
        });
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  text += `${assistant}:
`;
  return {
    prompt: text,
    stopSequences: [`
${user}:`]
  };
}

// src/completion/get-response-metadata.ts
import { createLanguageModelResponseMetadata as createLanguageModelResponseMetadata2 } from "@ai-sdk/provider-utils";

// src/completion/map-openai-finish-reason.ts
function mapOpenAIFinishReason2(finishReason) {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    case "function_call":
    case "tool_calls":
      return "tool-calls";
    default:
      return "other";
  }
}

// src/completion/openai-completion-api.ts
import { z as z5 } from "zod/v4";
import {
  lazySchema as lazySchema4,
  zodSchema as zodSchema4
} from "@ai-sdk/provider-utils";
var openaiCompletionResponseSchema = lazySchema4(
  () => zodSchema4(
    z5.object({
      id: z5.string().nullish(),
      created: z5.number().nullish(),
      model: z5.string().nullish(),
      choices: z5.array(
        z5.object({
          text: z5.string(),
          finish_reason: z5.string(),
          logprobs: z5.object({
            tokens: z5.array(z5.string()),
            token_logprobs: z5.array(z5.number()),
            top_logprobs: z5.array(z5.record(z5.string(), z5.number())).nullish()
          }).nullish()
        })
      ),
      usage: z5.object({
        prompt_tokens: z5.number(),
        completion_tokens: z5.number(),
        total_tokens: z5.number()
      }).nullish()
    })
  )
);
var openaiCompletionChunkSchema = lazySchema4(
  () => zodSchema4(
    z5.union([
      z5.object({
        id: z5.string().nullish(),
        created: z5.number().nullish(),
        model: z5.string().nullish(),
        choices: z5.array(
          z5.object({
            text: z5.string(),
            finish_reason: z5.string().nullish(),
            index: z5.number(),
            logprobs: z5.object({
              tokens: z5.array(z5.string()),
              token_logprobs: z5.array(z5.number()),
              top_logprobs: z5.array(z5.record(z5.string(), z5.number())).nullish()
            }).nullish()
          })
        ),
        usage: z5.object({
          prompt_tokens: z5.number(),
          completion_tokens: z5.number(),
          total_tokens: z5.number()
        }).nullish()
      }),
      openaiErrorDataSchema
    ])
  )
);

// src/completion/openai-completion-language-model.ts
var OpenAICompletionLanguageModel = class _OpenAICompletionLanguageModel {
  specificationVersion = "v4";
  modelId;
  config;
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
  }
  static [WORKFLOW_SERIALIZE2](model) {
    return serializeModelOptions2({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE2](options) {
    return new _OpenAICompletionLanguageModel(options.modelId, options.config);
  }
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  supportedUrls = {
    // No URLs are supported for completion models.
  };
  async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences: userStopSequences,
    responseFormat,
    tools,
    toolChoice,
    seed,
    providerOptions
  }) {
    const warnings = [];
    const openaiOptions = {
      ...await parseProviderOptions2({
        provider: "openai",
        providerOptions,
        schema: openaiLanguageModelCompletionOptions
      }),
      ...await parseProviderOptions2({
        provider: this.providerOptionsName,
        providerOptions,
        schema: openaiLanguageModelCompletionOptions
      })
    };
    if (topK != null) {
      warnings.push({ type: "unsupported", feature: "topK" });
    }
    if (tools?.length) {
      warnings.push({ type: "unsupported", feature: "tools" });
    }
    if (toolChoice != null) {
      warnings.push({ type: "unsupported", feature: "toolChoice" });
    }
    if (responseFormat != null && responseFormat.type !== "text") {
      warnings.push({
        type: "unsupported",
        feature: "responseFormat",
        details: "JSON response format is not supported."
      });
    }
    const { prompt: completionPrompt, stopSequences } = convertToOpenAICompletionPrompt({ prompt });
    const stop = [...stopSequences ?? [], ...userStopSequences ?? []];
    return {
      args: {
        // model id:
        model: this.modelId,
        // model specific settings:
        echo: openaiOptions.echo,
        logit_bias: openaiOptions.logitBias,
        logprobs: openaiOptions?.logprobs === true ? 0 : openaiOptions?.logprobs === false ? void 0 : openaiOptions?.logprobs,
        suffix: openaiOptions.suffix,
        user: openaiOptions.user,
        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        seed,
        // prompt:
        prompt: completionPrompt,
        // stop sequences:
        stop: stop.length > 0 ? stop : void 0
      },
      warnings
    };
  }
  async doGenerate(options) {
    const { args, warnings } = await this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await postJsonToApi2({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers?.(), options.headers),
      body: args,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
        openaiCompletionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const choice = response.choices[0];
    const providerMetadata = { openai: {} };
    if (choice.logprobs != null) {
      providerMetadata.openai.logprobs = choice.logprobs;
    }
    return {
      content: [{ type: "text", text: choice.text }],
      usage: convertOpenAICompletionUsage(response.usage),
      finishReason: {
        unified: mapOpenAIFinishReason2(choice.finish_reason),
        raw: choice.finish_reason ?? void 0
      },
      request: { body: args },
      response: {
        ...createLanguageModelResponseMetadata2(response),
        headers: responseHeaders,
        body: rawResponse
      },
      providerMetadata,
      warnings
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };
    const url = this.config.url({
      path: "/completions",
      modelId: this.modelId
    });
    const { responseHeaders, value: response } = await postJsonToApi2({
      url,
      headers: combineHeaders2(this.config.headers?.(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler2(
        openaiCompletionChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const checkedResponse = await throwIfOpenAIStreamErrorBeforeOutput({
      stream: response,
      getError: (chunk) => "error" in chunk ? chunk.error : void 0,
      isOutputChunk: isOpenAICompletionOutputChunk,
      url,
      requestBodyValues: body,
      responseHeaders
    });
    let finishReason = {
      unified: "other",
      raw: void 0
    };
    const providerMetadata = { openai: {} };
    let usage = void 0;
    let isFirstChunk = true;
    const result = {
      stream: checkedResponse.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
            if (!chunk.success) {
              finishReason = { unified: "error", raw: void 0 };
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if ("error" in value) {
              finishReason = { unified: "error", raw: void 0 };
              controller.enqueue({ type: "error", error: value.error });
              return;
            }
            if (isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({
                type: "response-metadata",
                ...createLanguageModelResponseMetadata2(value)
              });
              controller.enqueue({ type: "text-start", id: "0" });
            }
            if (value.usage != null) {
              usage = value.usage;
            }
            const choice = value.choices[0];
            if (choice?.finish_reason != null) {
              finishReason = {
                unified: mapOpenAIFinishReason2(choice.finish_reason),
                raw: choice.finish_reason
              };
            }
            if (choice?.logprobs != null) {
              providerMetadata.openai.logprobs = choice.logprobs;
            }
            if (choice?.text != null && choice.text.length > 0) {
              controller.enqueue({
                type: "text-delta",
                id: "0",
                delta: choice.text
              });
            }
          },
          flush(controller) {
            if (!isFirstChunk) {
              controller.enqueue({ type: "text-end", id: "0" });
            }
            controller.enqueue({
              type: "finish",
              finishReason,
              providerMetadata,
              usage: convertOpenAICompletionUsage(usage)
            });
          }
        })
      ),
      request: { body },
      response: { headers: responseHeaders }
    };
    return result;
  }
};
function isOpenAICompletionOutputChunk(chunk) {
  return !("error" in chunk) && chunk.choices.some((choice) => choice.text.length > 0);
}

// src/embedding/openai-embedding-model-options.ts
import {
  lazySchema as lazySchema5,
  zodSchema as zodSchema5
} from "@ai-sdk/provider-utils";
import { z as z6 } from "zod/v4";
var openaiEmbeddingModelOptions = lazySchema5(
  () => zodSchema5(
    z6.object({
      /**
       * The number of dimensions the resulting output embeddings should have.
       * Only supported in text-embedding-3 and later models.
       */
      dimensions: z6.number().optional(),
      /**
       * A unique identifier representing your end-user, which can help OpenAI to
       * monitor and detect abuse. Learn more.
       */
      user: z6.string().optional()
    })
  )
);

// src/embedding/openai-embedding-model.ts
import {
  TooManyEmbeddingValuesForCallError
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders3,
  createJsonResponseHandler as createJsonResponseHandler3,
  parseProviderOptions as parseProviderOptions3,
  postJsonToApi as postJsonToApi3,
  serializeModelOptions as serializeModelOptions3,
  WORKFLOW_DESERIALIZE as WORKFLOW_DESERIALIZE3,
  WORKFLOW_SERIALIZE as WORKFLOW_SERIALIZE3
} from "@ai-sdk/provider-utils";

// src/embedding/openai-embedding-api.ts
import { lazySchema as lazySchema6, zodSchema as zodSchema6 } from "@ai-sdk/provider-utils";
import { z as z7 } from "zod/v4";
var openaiTextEmbeddingResponseSchema = lazySchema6(
  () => zodSchema6(
    z7.object({
      data: z7.array(z7.object({ embedding: z7.array(z7.number()) })),
      usage: z7.object({ prompt_tokens: z7.number() }).nullish()
    })
  )
);

// src/embedding/openai-embedding-model.ts
var OpenAIEmbeddingModel = class _OpenAIEmbeddingModel {
  specificationVersion = "v4";
  modelId;
  maxEmbeddingsPerCall = 2048;
  supportsParallelCalls = true;
  config;
  static [WORKFLOW_SERIALIZE3](model) {
    return serializeModelOptions3({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE3](options) {
    return new _OpenAIEmbeddingModel(options.modelId, options.config);
  }
  get provider() {
    return this.config.provider;
  }
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions
  }) {
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      });
    }
    const openaiOptions = await parseProviderOptions3({
      provider: "openai",
      providerOptions,
      schema: openaiEmbeddingModelOptions
    }) ?? {};
    const {
      responseHeaders,
      value: response,
      rawValue
    } = await postJsonToApi3({
      url: this.config.url({
        path: "/embeddings",
        modelId: this.modelId
      }),
      headers: combineHeaders3(this.config.headers?.(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: "float",
        dimensions: openaiOptions.dimensions,
        user: openaiOptions.user
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler3(
        openaiTextEmbeddingResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      warnings: [],
      embeddings: response.data.map((item) => item.embedding),
      usage: response.usage ? { tokens: response.usage.prompt_tokens } : void 0,
      response: { headers: responseHeaders, body: rawValue }
    };
  }
};

// src/image/openai-image-model-options.ts
import {
  lazySchema as lazySchema7,
  zodSchema as zodSchema7
} from "@ai-sdk/provider-utils";
import { z as z8 } from "zod/v4";
var modelMaxImagesPerCall = {
  "dall-e-3": 1,
  "dall-e-2": 10,
  "gpt-image-1": 10,
  "gpt-image-1-mini": 10,
  "gpt-image-1.5": 10,
  "gpt-image-2": 10,
  "chatgpt-image-latest": 10
};
var defaultResponseFormatPrefixes = ["chatgpt-image-", "gpt-image-"];
function hasDefaultResponseFormat(modelId) {
  return defaultResponseFormatPrefixes.some(
    (prefix) => modelId.startsWith(prefix)
  );
}
function getMaxImagesPerCall(modelId) {
  return modelMaxImagesPerCall[modelId] ?? (modelId.startsWith("gpt-image-") ? 10 : 1);
}
var baseImageModelOptionsObject = z8.object({
  /**
   * Quality of the generated image(s).
   *
   * Valid values: `standard`, `hd`, `low`, `medium`, `high`, `auto`.
   */
  quality: z8.enum(["standard", "hd", "low", "medium", "high", "auto"]).optional(),
  /**
   * Background behavior for the generated image(s).
   *
   * If `transparent`, the output format must support transparency
   * (i.e. `png` or `webp`).
   */
  background: z8.enum(["transparent", "opaque", "auto"]).optional(),
  /**
   * Format in which the generated image(s) are returned.
   */
  outputFormat: z8.enum(["png", "jpeg", "webp"]).optional(),
  /**
   * Compression level (0-100) for the generated image(s). Applies to the
   * `jpeg` and `webp` output formats.
   */
  outputCompression: z8.number().int().min(0).max(100).optional(),
  /**
   * A unique identifier representing your end-user, which can help OpenAI
   * to monitor and detect abuse.
   */
  user: z8.string().optional()
});
var openaiImageModelOptions = lazySchema7(
  () => zodSchema7(baseImageModelOptionsObject)
);
var openaiImageModelGenerationOptions = lazySchema7(
  () => zodSchema7(
    baseImageModelOptionsObject.extend({
      /**
       * Style of the generated image. `vivid` produces hyper-real and
       * dramatic images; `natural` produces more subdued, less hyper-real
       * looking images.
       */
      style: z8.enum(["vivid", "natural"]).optional(),
      /**
       * Content moderation level for the generated image(s). `low` applies
       * less restrictive filtering.
       */
      moderation: z8.enum(["auto", "low"]).optional()
    })
  )
);
var openaiImageModelEditOptions = lazySchema7(
  () => zodSchema7(
    baseImageModelOptionsObject.extend({
      /**
       * Fidelity of the output image(s) to the input image(s).
       */
      inputFidelity: z8.enum(["high", "low"]).optional()
    })
  )
);

// src/image/openai-image-model.ts
import {
  combineHeaders as combineHeaders4,
  convertBase64ToUint8Array,
  convertToFormData,
  createJsonResponseHandler as createJsonResponseHandler4,
  downloadBlob,
  parseProviderOptions as parseProviderOptions4,
  postFormDataToApi,
  postJsonToApi as postJsonToApi4,
  serializeModelOptions as serializeModelOptions4,
  WORKFLOW_DESERIALIZE as WORKFLOW_DESERIALIZE4,
  WORKFLOW_SERIALIZE as WORKFLOW_SERIALIZE4
} from "@ai-sdk/provider-utils";

// src/image/openai-image-api.ts
import { lazySchema as lazySchema8, zodSchema as zodSchema8 } from "@ai-sdk/provider-utils";
import { z as z9 } from "zod/v4";
var openaiImageResponseSchema = lazySchema8(
  () => zodSchema8(
    z9.object({
      created: z9.number().nullish(),
      data: z9.array(
        z9.object({
          b64_json: z9.string(),
          revised_prompt: z9.string().nullish()
        })
      ),
      background: z9.string().nullish(),
      output_format: z9.string().nullish(),
      size: z9.string().nullish(),
      quality: z9.string().nullish(),
      usage: z9.object({
        input_tokens: z9.number().nullish(),
        output_tokens: z9.number().nullish(),
        total_tokens: z9.number().nullish(),
        input_tokens_details: z9.object({
          image_tokens: z9.number().nullish(),
          text_tokens: z9.number().nullish()
        }).nullish()
      }).nullish()
    })
  )
);

// src/image/openai-image-model.ts
var OpenAIImageModel = class _OpenAIImageModel {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  modelId;
  config;
  specificationVersion = "v4";
  static [WORKFLOW_SERIALIZE4](model) {
    return serializeModelOptions4({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE4](options) {
    return new _OpenAIImageModel(options.modelId, options.config);
  }
  get maxImagesPerCall() {
    return getMaxImagesPerCall(this.modelId);
  }
  get provider() {
    return this.config.provider;
  }
  async doGenerate({
    prompt,
    files,
    mask,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal
  }) {
    const warnings = [];
    if (aspectRatio != null) {
      warnings.push({
        type: "unsupported",
        feature: "aspectRatio",
        details: "This model does not support aspect ratio. Use `size` instead."
      });
    }
    if (seed != null) {
      warnings.push({ type: "unsupported", feature: "seed" });
    }
    const currentDate = this.config._internal?.currentDate?.() ?? /* @__PURE__ */ new Date();
    if (files != null) {
      const openaiOptions2 = await parseProviderOptions4({
        provider: "openai",
        providerOptions,
        schema: openaiImageModelEditOptions
      }) ?? {};
      const { value: response2, responseHeaders: responseHeaders2 } = await postFormDataToApi({
        url: this.config.url({
          path: "/images/edits",
          modelId: this.modelId
        }),
        headers: combineHeaders4(this.config.headers?.(), headers),
        formData: convertToFormData({
          model: this.modelId,
          prompt,
          image: await Promise.all(
            files.map(
              (file) => file.type === "file" ? new Blob(
                [
                  file.data instanceof Uint8Array ? new Blob([file.data], {
                    type: file.mediaType
                  }) : new Blob([convertBase64ToUint8Array(file.data)], {
                    type: file.mediaType
                  })
                ],
                { type: file.mediaType }
              ) : downloadBlob(file.url)
            )
          ),
          mask: mask != null ? await fileToBlob(mask) : void 0,
          n,
          size,
          quality: openaiOptions2.quality,
          background: openaiOptions2.background,
          output_format: openaiOptions2.outputFormat,
          output_compression: openaiOptions2.outputCompression,
          input_fidelity: openaiOptions2.inputFidelity,
          user: openaiOptions2.user
        }),
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler4(
          openaiImageResponseSchema
        ),
        abortSignal,
        fetch: this.config.fetch
      });
      return {
        images: response2.data.map((item) => item.b64_json),
        warnings,
        usage: response2.usage != null ? {
          inputTokens: response2.usage.input_tokens ?? void 0,
          outputTokens: response2.usage.output_tokens ?? void 0,
          totalTokens: response2.usage.total_tokens ?? void 0
        } : void 0,
        response: {
          timestamp: currentDate,
          modelId: this.modelId,
          headers: responseHeaders2
        },
        providerMetadata: {
          openai: {
            images: response2.data.map((item, index) => ({
              ...item.revised_prompt ? { revisedPrompt: item.revised_prompt } : {},
              created: response2.created ?? void 0,
              size: response2.size ?? void 0,
              quality: response2.quality ?? void 0,
              background: response2.background ?? void 0,
              outputFormat: response2.output_format ?? void 0,
              ...distributeTokenDetails(
                response2.usage?.input_tokens_details,
                index,
                response2.data.length
              )
            }))
          }
        }
      };
    }
    const openaiOptions = await parseProviderOptions4({
      provider: "openai",
      providerOptions,
      schema: openaiImageModelGenerationOptions
    }) ?? {};
    const { value: response, responseHeaders } = await postJsonToApi4({
      url: this.config.url({
        path: "/images/generations",
        modelId: this.modelId
      }),
      headers: combineHeaders4(this.config.headers?.(), headers),
      body: {
        model: this.modelId,
        prompt,
        n,
        size,
        quality: openaiOptions.quality,
        style: openaiOptions.style,
        background: openaiOptions.background,
        moderation: openaiOptions.moderation,
        output_format: openaiOptions.outputFormat,
        output_compression: openaiOptions.outputCompression,
        user: openaiOptions.user,
        ...!hasDefaultResponseFormat(this.modelId) ? { response_format: "b64_json" } : {}
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler4(
        openaiImageResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      images: response.data.map((item) => item.b64_json),
      warnings,
      usage: response.usage != null ? {
        inputTokens: response.usage.input_tokens ?? void 0,
        outputTokens: response.usage.output_tokens ?? void 0,
        totalTokens: response.usage.total_tokens ?? void 0
      } : void 0,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders
      },
      providerMetadata: {
        openai: {
          images: response.data.map((item, index) => ({
            ...item.revised_prompt ? { revisedPrompt: item.revised_prompt } : {},
            created: response.created ?? void 0,
            size: response.size ?? void 0,
            quality: response.quality ?? void 0,
            background: response.background ?? void 0,
            outputFormat: response.output_format ?? void 0,
            ...distributeTokenDetails(
              response.usage?.input_tokens_details,
              index,
              response.data.length
            )
          }))
        }
      }
    };
  }
};
function distributeTokenDetails(details, index, total) {
  if (details == null) {
    return {};
  }
  const result = {};
  if (details.image_tokens != null) {
    const base = Math.floor(details.image_tokens / total);
    const remainder = details.image_tokens - base * (total - 1);
    result.imageTokens = index === total - 1 ? remainder : base;
  }
  if (details.text_tokens != null) {
    const base = Math.floor(details.text_tokens / total);
    const remainder = details.text_tokens - base * (total - 1);
    result.textTokens = index === total - 1 ? remainder : base;
  }
  return result;
}
async function fileToBlob(file) {
  if (!file) return void 0;
  if (file.type === "url") {
    return downloadBlob(file.url);
  }
  const data = file.data instanceof Uint8Array ? file.data : convertBase64ToUint8Array(file.data);
  return new Blob([data], { type: file.mediaType });
}

// src/tool/apply-patch.ts
import {
  createProviderDefinedToolFactoryWithOutputSchema,
  lazySchema as lazySchema9,
  zodSchema as zodSchema9
} from "@ai-sdk/provider-utils";
import { z as z10 } from "zod/v4";
var applyPatchInputSchema = lazySchema9(
  () => zodSchema9(
    z10.object({
      callId: z10.string(),
      operation: z10.discriminatedUnion("type", [
        z10.object({
          type: z10.literal("create_file"),
          path: z10.string(),
          diff: z10.string()
        }),
        z10.object({
          type: z10.literal("delete_file"),
          path: z10.string()
        }),
        z10.object({
          type: z10.literal("update_file"),
          path: z10.string(),
          diff: z10.string()
        })
      ])
    })
  )
);
var applyPatchOutputSchema = lazySchema9(
  () => zodSchema9(
    z10.object({
      status: z10.enum(["completed", "failed"]),
      output: z10.string().optional()
    })
  )
);
var applyPatchArgsSchema = lazySchema9(() => zodSchema9(z10.object({})));
var applyPatchToolFactory = createProviderDefinedToolFactoryWithOutputSchema({
  id: "openai.apply_patch",
  inputSchema: applyPatchInputSchema,
  outputSchema: applyPatchOutputSchema
});
var applyPatch = applyPatchToolFactory;

// src/tool/code-interpreter.ts
import {
  createProviderExecutedToolFactory,
  lazySchema as lazySchema10,
  zodSchema as zodSchema10
} from "@ai-sdk/provider-utils";
import { z as z11 } from "zod/v4";
var codeInterpreterInputSchema = lazySchema10(
  () => zodSchema10(
    z11.object({
      code: z11.string().nullish(),
      containerId: z11.string()
    })
  )
);
var codeInterpreterOutputSchema = lazySchema10(
  () => zodSchema10(
    z11.object({
      outputs: z11.array(
        z11.discriminatedUnion("type", [
          z11.object({ type: z11.literal("logs"), logs: z11.string() }),
          z11.object({ type: z11.literal("image"), url: z11.string() })
        ])
      ).nullish()
    })
  )
);
var codeInterpreterArgsSchema = lazySchema10(
  () => zodSchema10(
    z11.object({
      container: z11.union([
        z11.string(),
        z11.object({
          fileIds: z11.array(z11.string()).optional()
        })
      ]).optional()
    })
  )
);
var codeInterpreterToolFactory = createProviderExecutedToolFactory({
  id: "openai.code_interpreter",
  inputSchema: codeInterpreterInputSchema,
  outputSchema: codeInterpreterOutputSchema
});
var codeInterpreter = (args = {}) => {
  return codeInterpreterToolFactory(args);
};

// src/tool/file-search.ts
import {
  createProviderExecutedToolFactory as createProviderExecutedToolFactory2,
  lazySchema as lazySchema11,
  zodSchema as zodSchema11
} from "@ai-sdk/provider-utils";
import { z as z12 } from "zod/v4";
var comparisonFilterSchema = z12.object({
  key: z12.string(),
  type: z12.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin"]),
  value: z12.union([z12.string(), z12.number(), z12.boolean(), z12.array(z12.string())])
});
var compoundFilterSchema = z12.object({
  type: z12.enum(["and", "or"]),
  filters: z12.array(
    z12.union([comparisonFilterSchema, z12.lazy(() => compoundFilterSchema)])
  )
});
var fileSearchArgsSchema = lazySchema11(
  () => zodSchema11(
    z12.object({
      vectorStoreIds: z12.array(z12.string()),
      maxNumResults: z12.number().optional(),
      ranking: z12.object({
        ranker: z12.string().optional(),
        scoreThreshold: z12.number().optional()
      }).optional(),
      filters: z12.union([comparisonFilterSchema, compoundFilterSchema]).optional()
    })
  )
);
var fileSearchOutputSchema = lazySchema11(
  () => zodSchema11(
    z12.object({
      queries: z12.array(z12.string()),
      results: z12.array(
        z12.object({
          attributes: z12.record(z12.string(), z12.unknown()),
          fileId: z12.string(),
          filename: z12.string(),
          score: z12.number(),
          text: z12.string()
        })
      ).nullable()
    })
  )
);
var fileSearch = createProviderExecutedToolFactory2({
  id: "openai.file_search",
  inputSchema: z12.object({}),
  outputSchema: fileSearchOutputSchema
});

// src/tool/image-generation.ts
import {
  createProviderExecutedToolFactory as createProviderExecutedToolFactory3,
  lazySchema as lazySchema12,
  zodSchema as zodSchema12
} from "@ai-sdk/provider-utils";
import { z as z13 } from "zod/v4";
var imageGenerationArgsSchema = lazySchema12(
  () => zodSchema12(
    z13.object({
      background: z13.enum(["auto", "opaque", "transparent"]).optional(),
      inputFidelity: z13.enum(["low", "high"]).optional(),
      inputImageMask: z13.object({
        fileId: z13.string().optional(),
        imageUrl: z13.string().optional()
      }).optional(),
      model: z13.string().optional(),
      moderation: z13.enum(["auto"]).optional(),
      outputCompression: z13.number().int().min(0).max(100).optional(),
      outputFormat: z13.enum(["png", "jpeg", "webp"]).optional(),
      partialImages: z13.number().int().min(0).max(3).optional(),
      quality: z13.enum(["auto", "low", "medium", "high"]).optional(),
      size: z13.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]).optional()
    }).strict()
  )
);
var imageGenerationInputSchema = lazySchema12(() => zodSchema12(z13.object({})));
var imageGenerationOutputSchema = lazySchema12(
  () => zodSchema12(z13.object({ result: z13.string() }))
);
var imageGenerationToolFactory = createProviderExecutedToolFactory3({
  id: "openai.image_generation",
  inputSchema: imageGenerationInputSchema,
  outputSchema: imageGenerationOutputSchema
});
var imageGeneration = (args = {}) => {
  return imageGenerationToolFactory(args);
};

// src/tool/web-search.ts
import {
  createProviderExecutedToolFactory as createProviderExecutedToolFactory4,
  lazySchema as lazySchema13,
  zodSchema as zodSchema13
} from "@ai-sdk/provider-utils";
import { z as z14 } from "zod/v4";
var webSearchArgsSchema = lazySchema13(
  () => zodSchema13(
    z14.object({
      externalWebAccess: z14.boolean().optional(),
      filters: z14.object({
        allowedDomains: z14.array(z14.string()).optional(),
        blockedDomains: z14.array(z14.string()).optional()
      }).optional(),
      searchContextSize: z14.enum(["low", "medium", "high"]).optional(),
      userLocation: z14.object({
        type: z14.literal("approximate"),
        country: z14.string().optional(),
        city: z14.string().optional(),
        region: z14.string().optional(),
        timezone: z14.string().optional()
      }).optional()
    })
  )
);
var webSearchInputSchema = lazySchema13(() => zodSchema13(z14.object({})));
var webSearchOutputSchema = lazySchema13(
  () => zodSchema13(
    z14.object({
      action: z14.discriminatedUnion("type", [
        z14.object({
          type: z14.literal("search"),
          query: z14.string().optional(),
          queries: z14.array(z14.string()).optional()
        }),
        z14.object({
          type: z14.literal("openPage"),
          url: z14.string().nullish()
        }),
        z14.object({
          type: z14.literal("findInPage"),
          url: z14.string().nullish(),
          pattern: z14.string().nullish()
        })
      ]).optional(),
      sources: z14.array(
        z14.discriminatedUnion("type", [
          z14.object({ type: z14.literal("url"), url: z14.string() }),
          z14.object({ type: z14.literal("api"), name: z14.string() })
        ])
      ).optional()
    })
  )
);
var webSearchToolFactory = createProviderExecutedToolFactory4({
  id: "openai.web_search",
  inputSchema: webSearchInputSchema,
  outputSchema: webSearchOutputSchema
});
var webSearch = (args = {}) => webSearchToolFactory(args);

// src/tool/web-search-preview.ts
import {
  createProviderExecutedToolFactory as createProviderExecutedToolFactory5,
  lazySchema as lazySchema14,
  zodSchema as zodSchema14
} from "@ai-sdk/provider-utils";
import { z as z15 } from "zod/v4";
var webSearchPreviewArgsSchema = lazySchema14(
  () => zodSchema14(
    z15.object({
      searchContextSize: z15.enum(["low", "medium", "high"]).optional(),
      userLocation: z15.object({
        type: z15.literal("approximate"),
        country: z15.string().optional(),
        city: z15.string().optional(),
        region: z15.string().optional(),
        timezone: z15.string().optional()
      }).optional()
    })
  )
);
var webSearchPreviewInputSchema = lazySchema14(
  () => zodSchema14(z15.object({}))
);
var webSearchPreviewOutputSchema = lazySchema14(
  () => zodSchema14(
    z15.object({
      action: z15.discriminatedUnion("type", [
        z15.object({
          type: z15.literal("search"),
          query: z15.string().optional()
        }),
        z15.object({
          type: z15.literal("openPage"),
          url: z15.string().nullish()
        }),
        z15.object({
          type: z15.literal("findInPage"),
          url: z15.string().nullish(),
          pattern: z15.string().nullish()
        })
      ]).optional()
    })
  )
);
var webSearchPreview = createProviderExecutedToolFactory5({
  id: "openai.web_search_preview",
  inputSchema: webSearchPreviewInputSchema,
  outputSchema: webSearchPreviewOutputSchema
});

// src/tool/programmatic-tool-calling.ts
import {
  createProviderExecutedToolFactory as createProviderExecutedToolFactory6,
  experimental_toolCaller,
  lazySchema as lazySchema15,
  zodSchema as zodSchema15
} from "@ai-sdk/provider-utils";
import { z as z16 } from "zod/v4";
var programmaticToolCallingInputSchema = lazySchema15(
  () => zodSchema15(
    z16.object({
      code: z16.string(),
      fingerprint: z16.string()
    })
  )
);
var programmaticToolCallingOutputSchema = lazySchema15(
  () => zodSchema15(
    z16.object({
      result: z16.string(),
      status: z16.enum(["completed", "incomplete"])
    })
  )
);
var programmaticToolCallingFactory = createProviderExecutedToolFactory6({
  id: "openai.programmatic_tool_calling",
  inputSchema: programmaticToolCallingInputSchema,
  outputSchema: programmaticToolCallingOutputSchema,
  supportsDeferredResults: true
});
var programmaticToolCalling = () => experimental_toolCaller(programmaticToolCallingFactory({}), {
  type: "provider",
  prepareProviderOptions: (providerOptions) => {
    const openaiOptions = providerOptions?.openai;
    return {
      ...providerOptions,
      openai: {
        ...openaiOptions,
        allowedCallers: [
          .../* @__PURE__ */ new Set([
            ...openaiOptions?.allowedCallers ?? [],
            "programmatic"
          ])
        ]
      }
    };
  }
});

// src/responses/openai-responses-language-model.ts
import {
  APICallError as APICallError2
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders5,
  createEventSourceResponseHandler as createEventSourceResponseHandler3,
  createJsonResponseHandler as createJsonResponseHandler5,
  createToolNameMapping,
  generateId as generateId2,
  isCustomReasoning as isCustomReasoning2,
  parseProviderOptions as parseProviderOptions6,
  postJsonToApi as postJsonToApi5,
  serializeModelOptions as serializeModelOptions5,
  WORKFLOW_DESERIALIZE as WORKFLOW_DESERIALIZE5,
  WORKFLOW_SERIALIZE as WORKFLOW_SERIALIZE5
} from "@ai-sdk/provider-utils";

// src/responses/convert-openai-responses-usage.ts
import { createNullLanguageModelUsage as createNullLanguageModelUsage3 } from "@ai-sdk/provider-utils";
function convertOpenAIResponsesUsage(usage) {
  if (usage == null) {
    return createNullLanguageModelUsage3();
  }
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0;
  const cacheWriteTokens = usage.input_tokens_details?.cache_write_tokens ?? void 0;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0;
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens - cachedTokens - (cacheWriteTokens ?? 0),
      cacheRead: cachedTokens,
      cacheWrite: cacheWriteTokens
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens - reasoningTokens,
      reasoning: reasoningTokens
    },
    raw: usage
  };
}

// src/responses/convert-to-openai-responses-input.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError4
} from "@ai-sdk/provider";
import {
  convertToBase64 as convertToBase642,
  getTopLevelMediaType as getTopLevelMediaType2,
  isNonNullable,
  parseJSON,
  parseProviderOptions as parseProviderOptions5,
  resolveFullMediaType as resolveFullMediaType2,
  resolveProviderReference as resolveProviderReference2,
  validateTypes
} from "@ai-sdk/provider-utils";
import { z as z21 } from "zod/v4";

// src/tool/computer.ts
import {
  createProviderDefinedToolFactoryWithOutputSchema as createProviderDefinedToolFactoryWithOutputSchema2,
  lazySchema as lazySchema16,
  zodSchema as zodSchema16
} from "@ai-sdk/provider-utils";
import { z as z17 } from "zod/v4";
var safetyCheckSchema = z17.object({
  id: z17.string(),
  code: z17.string().optional(),
  message: z17.string().optional()
});
var computerActionSchema = z17.discriminatedUnion("type", [
  z17.object({
    type: z17.literal("click"),
    button: z17.enum(["left", "right", "wheel", "back", "forward"]),
    x: z17.number(),
    y: z17.number(),
    keys: z17.array(z17.string()).optional()
  }),
  z17.object({
    type: z17.literal("double_click"),
    x: z17.number(),
    y: z17.number(),
    keys: z17.array(z17.string()).optional()
  }),
  z17.object({
    type: z17.literal("drag"),
    path: z17.array(z17.object({ x: z17.number(), y: z17.number() })),
    keys: z17.array(z17.string()).optional()
  }),
  z17.object({
    type: z17.literal("keypress"),
    keys: z17.array(z17.string())
  }),
  z17.object({
    type: z17.literal("move"),
    x: z17.number(),
    y: z17.number(),
    keys: z17.array(z17.string()).optional()
  }),
  z17.object({
    type: z17.literal("screenshot")
  }),
  z17.object({
    type: z17.literal("scroll"),
    x: z17.number(),
    y: z17.number(),
    scrollX: z17.number(),
    scrollY: z17.number(),
    keys: z17.array(z17.string()).optional()
  }),
  z17.object({
    type: z17.literal("type"),
    text: z17.string()
  }),
  z17.object({
    type: z17.literal("wait")
  })
]);
var computerInputSchema = lazySchema16(
  () => zodSchema16(
    z17.object({
      actions: z17.array(computerActionSchema),
      pendingSafetyChecks: z17.array(safetyCheckSchema),
      status: z17.enum(["in_progress", "completed", "incomplete"])
    })
  )
);
var computerOutputSchema = lazySchema16(
  () => zodSchema16(
    z17.object({
      output: z17.union([
        z17.object({
          type: z17.literal("computer_screenshot"),
          imageUrl: z17.string(),
          fileId: z17.string().optional(),
          detail: z17.enum(["auto", "low", "high", "original"]).optional()
        }),
        z17.object({
          type: z17.literal("computer_screenshot"),
          fileId: z17.string(),
          imageUrl: z17.string().optional(),
          detail: z17.enum(["auto", "low", "high", "original"]).optional()
        })
      ]),
      acknowledgedSafetyChecks: z17.array(safetyCheckSchema).optional()
    })
  )
);
var computerToolFactory = createProviderDefinedToolFactoryWithOutputSchema2({
  id: "openai.computer",
  inputSchema: computerInputSchema,
  outputSchema: computerOutputSchema
});
var computer = (options = {}) => computerToolFactory(options);

// src/tool/local-shell.ts
import {
  createProviderDefinedToolFactoryWithOutputSchema as createProviderDefinedToolFactoryWithOutputSchema3,
  lazySchema as lazySchema17,
  zodSchema as zodSchema17
} from "@ai-sdk/provider-utils";
import { z as z18 } from "zod/v4";
var localShellInputSchema = lazySchema17(
  () => zodSchema17(
    z18.object({
      action: z18.object({
        type: z18.literal("exec"),
        command: z18.array(z18.string()),
        timeoutMs: z18.number().optional(),
        user: z18.string().optional(),
        workingDirectory: z18.string().optional(),
        env: z18.record(z18.string(), z18.string()).optional()
      })
    })
  )
);
var localShellOutputSchema = lazySchema17(
  () => zodSchema17(z18.object({ output: z18.string() }))
);
var localShell = createProviderDefinedToolFactoryWithOutputSchema3({
  id: "openai.local_shell",
  inputSchema: localShellInputSchema,
  outputSchema: localShellOutputSchema
});

// src/tool/shell.ts
import {
  createProviderDefinedToolFactoryWithOutputSchema as createProviderDefinedToolFactoryWithOutputSchema4,
  lazySchema as lazySchema18,
  zodSchema as zodSchema18
} from "@ai-sdk/provider-utils";
import { z as z19 } from "zod/v4";
var shellInputSchema = lazySchema18(
  () => zodSchema18(
    z19.object({
      action: z19.object({
        commands: z19.array(z19.string()),
        timeoutMs: z19.number().optional(),
        maxOutputLength: z19.number().optional()
      })
    })
  )
);
var shellOutputSchema = lazySchema18(
  () => zodSchema18(
    z19.object({
      output: z19.array(
        z19.object({
          stdout: z19.string(),
          stderr: z19.string(),
          outcome: z19.discriminatedUnion("type", [
            z19.object({ type: z19.literal("timeout") }),
            z19.object({ type: z19.literal("exit"), exitCode: z19.number() })
          ])
        })
      )
    })
  )
);
var shellSkillsSchema = z19.array(
  z19.discriminatedUnion("type", [
    z19.object({
      type: z19.literal("skillReference"),
      providerReference: z19.record(z19.string(), z19.string()),
      version: z19.string().optional()
    }),
    z19.object({
      type: z19.literal("inline"),
      name: z19.string(),
      description: z19.string(),
      source: z19.object({
        type: z19.literal("base64"),
        mediaType: z19.literal("application/zip"),
        data: z19.string()
      })
    })
  ])
).optional();
var shellArgsSchema = lazySchema18(
  () => zodSchema18(
    z19.object({
      environment: z19.union([
        z19.object({
          type: z19.literal("containerAuto"),
          fileIds: z19.array(z19.string()).optional(),
          memoryLimit: z19.enum(["1g", "4g", "16g", "64g"]).optional(),
          networkPolicy: z19.discriminatedUnion("type", [
            z19.object({ type: z19.literal("disabled") }),
            z19.object({
              type: z19.literal("allowlist"),
              allowedDomains: z19.array(z19.string()),
              domainSecrets: z19.array(
                z19.object({
                  domain: z19.string(),
                  name: z19.string(),
                  value: z19.string()
                })
              ).optional()
            })
          ]).optional(),
          skills: shellSkillsSchema
        }),
        z19.object({
          type: z19.literal("containerReference"),
          containerId: z19.string()
        }),
        z19.object({
          type: z19.literal("local").optional(),
          skills: z19.array(
            z19.object({
              name: z19.string(),
              description: z19.string(),
              path: z19.string()
            })
          ).optional()
        })
      ]).optional()
    })
  )
);
var shell = createProviderDefinedToolFactoryWithOutputSchema4({
  id: "openai.shell",
  inputSchema: shellInputSchema,
  outputSchema: shellOutputSchema
});

// src/tool/tool-search.ts
import {
  createProviderDefinedToolFactoryWithOutputSchema as createProviderDefinedToolFactoryWithOutputSchema5,
  lazySchema as lazySchema19,
  zodSchema as zodSchema19
} from "@ai-sdk/provider-utils";
import { z as z20 } from "zod/v4";
var toolSearchArgsSchema = lazySchema19(
  () => zodSchema19(
    z20.object({
      execution: z20.enum(["server", "client"]).optional(),
      description: z20.string().optional(),
      parameters: z20.record(z20.string(), z20.unknown()).optional()
    })
  )
);
var toolSearchInputSchema = lazySchema19(
  () => zodSchema19(
    z20.object({
      arguments: z20.unknown().optional(),
      call_id: z20.string().nullish()
    })
  )
);
var toolSearchOutputSchema = lazySchema19(
  () => zodSchema19(
    z20.object({
      tools: z20.array(z20.record(z20.string(), z20.unknown()))
    })
  )
);
var toolSearchToolFactory = createProviderDefinedToolFactoryWithOutputSchema5({
  id: "openai.tool_search",
  inputSchema: toolSearchInputSchema,
  outputSchema: toolSearchOutputSchema
});
var toolSearch = (args = {}) => toolSearchToolFactory(args);

// src/responses/convert-to-openai-responses-input.ts
function serializeToolCallArguments2(input) {
  return JSON.stringify(input === void 0 ? {} : input);
}
function mapToolCaller(caller) {
  return caller == null ? void 0 : caller.type === "program" ? { type: "program", caller_id: caller.callerId } : caller;
}
function getPromptCacheBreakpoint2(providerOptions, providerOptionsName) {
  return providerOptions?.[providerOptionsName]?.promptCacheBreakpoint;
}
function isFileId(data, prefixes) {
  if (!prefixes) return false;
  return prefixes.some((prefix) => data.startsWith(prefix));
}
async function convertToOpenAIResponsesInput({
  prompt,
  toolNameMapping,
  systemMessageMode,
  providerOptionsName,
  fileIdPrefixes,
  passThroughUnsupportedFiles = false,
  store,
  hasConversation = false,
  hasPreviousResponseId = false,
  avoidAssistantMessageItemReferences = false,
  avoidReasoningItemReferences = false,
  avoidToolSearchItemReferences = false,
  hasLocalShellTool = false,
  hasShellTool = false,
  hasApplyPatchTool = false,
  hasComputerTool = false,
  customProviderToolNames,
  outputSchemaToolNames
}) {
  let input = [];
  const warnings = [];
  const processedApprovalIds = /* @__PURE__ */ new Set();
  for (const { role, content, providerOptions } of prompt) {
    switch (role) {
      case "system": {
        switch (systemMessageMode) {
          case "system": {
            const promptCacheBreakpoint = getPromptCacheBreakpoint2(
              providerOptions,
              providerOptionsName
            );
            input.push({
              role: "system",
              content: promptCacheBreakpoint == null ? content : [
                {
                  type: "input_text",
                  text: content,
                  prompt_cache_breakpoint: promptCacheBreakpoint
                }
              ]
            });
            break;
          }
          case "developer": {
            const promptCacheBreakpoint = getPromptCacheBreakpoint2(
              providerOptions,
              providerOptionsName
            );
            input.push({
              role: "developer",
              content: promptCacheBreakpoint == null ? content : [
                {
                  type: "input_text",
                  text: content,
                  prompt_cache_breakpoint: promptCacheBreakpoint
                }
              ]
            });
            break;
          }
          case "remove": {
            warnings.push({
              type: "other",
              message: "system messages are removed for this model"
            });
            break;
          }
          default: {
            const _exhaustiveCheck = systemMessageMode;
            throw new Error(
              `Unsupported system message mode: ${_exhaustiveCheck}`
            );
          }
        }
        break;
      }
      case "user": {
        input.push({
          role: "user",
          content: content.map((part, index) => {
            switch (part.type) {
              case "text": {
                const promptCacheBreakpoint = getPromptCacheBreakpoint2(
                  part.providerOptions,
                  providerOptionsName
                );
                return {
                  type: "input_text",
                  text: part.text,
                  ...promptCacheBreakpoint != null && {
                    prompt_cache_breakpoint: promptCacheBreakpoint
                  }
                };
              }
              case "file": {
                const promptCacheBreakpoint = getPromptCacheBreakpoint2(
                  part.providerOptions,
                  providerOptionsName
                );
                switch (part.data.type) {
                  case "reference": {
                    const fileId = resolveProviderReference2({
                      reference: part.data.reference,
                      provider: providerOptionsName
                    });
                    if (getTopLevelMediaType2(part.mediaType) === "image") {
                      return {
                        type: "input_image",
                        file_id: fileId,
                        detail: part.providerOptions?.[providerOptionsName]?.imageDetail,
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    }
                    return {
                      type: "input_file",
                      file_id: fileId,
                      ...promptCacheBreakpoint != null && {
                        prompt_cache_breakpoint: promptCacheBreakpoint
                      }
                    };
                  }
                  case "text": {
                    throw new UnsupportedFunctionalityError4({
                      functionality: "text file parts"
                    });
                  }
                  case "url":
                  case "data": {
                    const topLevel = getTopLevelMediaType2(part.mediaType);
                    if (topLevel === "image") {
                      return {
                        type: "input_image",
                        ...part.data.type === "url" ? { image_url: part.data.url.toString() } : typeof part.data.data === "string" && isFileId(part.data.data, fileIdPrefixes) ? { file_id: part.data.data } : {
                          image_url: `data:${resolveFullMediaType2({ part })};base64,${convertToBase642(part.data.data)}`
                        },
                        detail: part.providerOptions?.[providerOptionsName]?.imageDetail,
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    } else {
                      if (part.data.type === "url") {
                        return {
                          type: "input_file",
                          file_url: part.data.url.toString(),
                          ...promptCacheBreakpoint != null && {
                            prompt_cache_breakpoint: promptCacheBreakpoint
                          }
                        };
                      }
                      const fullMediaType = resolveFullMediaType2({ part });
                      if (fullMediaType !== "application/pdf" && !passThroughUnsupportedFiles) {
                        throw new UnsupportedFunctionalityError4({
                          functionality: `file part media type ${fullMediaType}`
                        });
                      }
                      return {
                        type: "input_file",
                        ...typeof part.data.data === "string" && isFileId(part.data.data, fileIdPrefixes) ? { file_id: part.data.data } : {
                          filename: part.filename ?? (fullMediaType === "application/pdf" ? `part-${index}.pdf` : `part-${index}`),
                          file_data: `data:${fullMediaType};base64,${convertToBase642(part.data.data)}`
                        },
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    }
                  }
                }
              }
            }
          })
        });
        break;
      }
      case "assistant": {
        const reasoningMessages = {};
        for (const part of content) {
          switch (part.type) {
            case "text": {
              const providerOptions2 = part.providerOptions?.[providerOptionsName];
              const id = providerOptions2?.itemId;
              const phase = providerOptions2?.phase;
              if (hasConversation && id != null) {
                break;
              }
              if (store && id != null && !avoidAssistantMessageItemReferences) {
                input.push({ type: "item_reference", id });
                break;
              }
              input.push({
                role: "assistant",
                content: [{ type: "output_text", text: part.text }],
                id,
                ...phase != null && { phase }
              });
              break;
            }
            case "tool-call": {
              const id = part.providerOptions?.[providerOptionsName]?.itemId ?? part.providerMetadata?.[providerOptionsName]?.itemId;
              const namespace = part.providerOptions?.[providerOptionsName]?.namespace ?? part.providerMetadata?.[providerOptionsName]?.namespace;
              const caller = part.providerOptions?.[providerOptionsName]?.caller;
              if (hasConversation && id != null) {
                break;
              }
              const resolvedToolName = toolNameMapping.toProviderToolName(
                part.toolName
              );
              if (resolvedToolName === "tool_search") {
                if (store && id != null && !avoidToolSearchItemReferences) {
                  input.push({ type: "item_reference", id });
                  break;
                }
                const parsedInput = typeof part.input === "string" ? await parseJSON({
                  text: part.input,
                  schema: toolSearchInputSchema
                }) : await validateTypes({
                  value: part.input,
                  schema: toolSearchInputSchema
                });
                const execution = parsedInput.call_id != null ? "client" : "server";
                input.push({
                  type: "tool_search_call",
                  id: id ?? part.toolCallId,
                  execution,
                  call_id: parsedInput.call_id ?? null,
                  status: "completed",
                  arguments: parsedInput.arguments
                });
                break;
              }
              if (resolvedToolName === "programmatic_tool_calling") {
                if (store && id != null) {
                  input.push({ type: "item_reference", id });
                  break;
                }
                const parsedInput = await validateTypes({
                  value: part.input,
                  schema: programmaticToolCallingInputSchema
                });
                input.push({
                  type: "program",
                  id: id ?? part.toolCallId,
                  call_id: part.toolCallId,
                  code: parsedInput.code,
                  fingerprint: parsedInput.fingerprint
                });
                break;
              }
              if (part.providerExecuted) {
                if (store && id != null && !(avoidToolSearchItemReferences && id.startsWith("tsc_"))) {
                  input.push({ type: "item_reference", id });
                }
                break;
              }
              if (hasPreviousResponseId && store && id != null) {
                break;
              }
              const isProviderDefinedToolCall = hasLocalShellTool && resolvedToolName === "local_shell" || hasShellTool && resolvedToolName === "shell" || hasApplyPatchTool && resolvedToolName === "apply_patch" || hasComputerTool && resolvedToolName === "computer" || (customProviderToolNames?.has(resolvedToolName) ?? false);
              if (store && id != null && isProviderDefinedToolCall) {
                input.push({ type: "item_reference", id });
                break;
              }
              if (hasLocalShellTool && resolvedToolName === "local_shell") {
                const parsedInput = await validateTypes({
                  value: part.input,
                  schema: localShellInputSchema
                });
                input.push({
                  type: "local_shell_call",
                  call_id: part.toolCallId,
                  id,
                  action: {
                    type: "exec",
                    command: parsedInput.action.command,
                    timeout_ms: parsedInput.action.timeoutMs,
                    user: parsedInput.action.user,
                    working_directory: parsedInput.action.workingDirectory,
                    env: parsedInput.action.env
                  }
                });
                break;
              }
              if (hasShellTool && resolvedToolName === "shell") {
                const parsedInput = await validateTypes({
                  value: part.input,
                  schema: shellInputSchema
                });
                input.push({
                  type: "shell_call",
                  call_id: part.toolCallId,
                  id,
                  status: "completed",
                  action: {
                    commands: parsedInput.action.commands,
                    timeout_ms: parsedInput.action.timeoutMs,
                    max_output_length: parsedInput.action.maxOutputLength
                  }
                });
                break;
              }
              if (hasApplyPatchTool && resolvedToolName === "apply_patch") {
                const parsedInput = await validateTypes({
                  value: part.input,
                  schema: applyPatchInputSchema
                });
                input.push({
                  type: "apply_patch_call",
                  call_id: parsedInput.callId,
                  id,
                  status: "completed",
                  operation: parsedInput.operation
                });
                break;
              }
              if (hasComputerTool && resolvedToolName === "computer") {
                const parsedInput = await validateTypes({
                  value: part.input,
                  schema: computerInputSchema
                });
                input.push({
                  type: "computer_call",
                  call_id: part.toolCallId,
                  id,
                  status: parsedInput.status,
                  actions: parsedInput.actions.map((action) => {
                    switch (action.type) {
                      case "click":
                      case "double_click":
                      case "move":
                        return {
                          ...action,
                          keys: action.keys
                        };
                      case "drag":
                        return {
                          ...action,
                          keys: action.keys
                        };
                      case "scroll":
                        return {
                          type: "scroll",
                          x: action.x,
                          y: action.y,
                          scroll_x: action.scrollX,
                          scroll_y: action.scrollY,
                          keys: action.keys
                        };
                      default:
                        return action;
                    }
                  }),
                  pending_safety_checks: parsedInput.pendingSafetyChecks.map(
                    (safetyCheck) => ({
                      id: safetyCheck.id,
                      code: safetyCheck.code,
                      message: safetyCheck.message
                    })
                  )
                });
                break;
              }
              if (customProviderToolNames?.has(resolvedToolName)) {
                input.push({
                  type: "custom_tool_call",
                  call_id: part.toolCallId,
                  name: resolvedToolName,
                  input: typeof part.input === "string" ? part.input : JSON.stringify(part.input),
                  id
                });
                break;
              }
              input.push({
                type: "function_call",
                call_id: part.toolCallId,
                name: resolvedToolName,
                arguments: serializeToolCallArguments2(part.input),
                ...namespace != null && { namespace },
                ...caller != null && {
                  caller: mapToolCaller(caller)
                }
              });
              break;
            }
            // assistant tool result parts are from provider-executed tools:
            case "tool-result": {
              if (part.output.type === "execution-denied" || part.output.type === "json" && typeof part.output.value === "object" && part.output.value != null && "type" in part.output.value && part.output.value.type === "execution-denied") {
                break;
              }
              if (hasConversation) {
                break;
              }
              const resolvedResultToolName = toolNameMapping.toProviderToolName(
                part.toolName
              );
              if (resolvedResultToolName === "tool_search") {
                const itemId = part.providerOptions?.[providerOptionsName]?.itemId ?? part.providerMetadata?.[providerOptionsName]?.itemId ?? part.toolCallId;
                if (store && !avoidToolSearchItemReferences) {
                  input.push({ type: "item_reference", id: itemId });
                } else if (part.output.type === "json") {
                  const parsedOutput = await validateTypes({
                    value: part.output.value,
                    schema: toolSearchOutputSchema
                  });
                  input.push({
                    type: "tool_search_output",
                    id: itemId,
                    execution: "server",
                    call_id: null,
                    status: "completed",
                    tools: parsedOutput.tools
                  });
                }
                break;
              }
              if (resolvedResultToolName === "programmatic_tool_calling") {
                const itemId = part.providerOptions?.[providerOptionsName]?.itemId ?? part.providerMetadata?.[providerOptionsName]?.itemId ?? part.toolCallId;
                if (store) {
                  input.push({ type: "item_reference", id: itemId });
                } else if (part.output.type === "json") {
                  const parsedOutput = await validateTypes({
                    value: part.output.value,
                    schema: programmaticToolCallingOutputSchema
                  });
                  input.push({
                    type: "program_output",
                    id: itemId,
                    call_id: part.toolCallId,
                    result: parsedOutput.result,
                    status: parsedOutput.status
                  });
                }
                break;
              }
              if (hasShellTool && resolvedResultToolName === "shell") {
                if (part.output.type === "json") {
                  const parsedOutput = await validateTypes({
                    value: part.output.value,
                    schema: shellOutputSchema
                  });
                  input.push({
                    type: "shell_call_output",
                    call_id: part.toolCallId,
                    output: parsedOutput.output.map((item) => ({
                      stdout: item.stdout,
                      stderr: item.stderr,
                      outcome: item.outcome.type === "timeout" ? { type: "timeout" } : {
                        type: "exit",
                        exit_code: item.outcome.exitCode
                      }
                    }))
                  });
                }
                break;
              }
              if (store) {
                const itemId = part.providerOptions?.[providerOptionsName]?.itemId ?? part.toolCallId;
                if (avoidToolSearchItemReferences && itemId.startsWith("tsc_")) {
                  break;
                }
                input.push({ type: "item_reference", id: itemId });
              } else {
                warnings.push({
                  type: "other",
                  message: `Results for OpenAI tool ${part.toolName} are not sent to the API when store is false`
                });
              }
              break;
            }
            case "reasoning": {
              const providerOptions2 = await parseProviderOptions5({
                provider: providerOptionsName,
                providerOptions: part.providerOptions,
                schema: openaiResponsesReasoningProviderOptionsSchema
              });
              const reasoningId = providerOptions2?.itemId;
              if ((hasConversation || hasPreviousResponseId) && reasoningId != null) {
                break;
              }
              if (reasoningId != null) {
                const reasoningMessage = reasoningMessages[reasoningId];
                if (store && !avoidReasoningItemReferences) {
                  if (reasoningMessage === void 0) {
                    input.push({ type: "item_reference", id: reasoningId });
                    reasoningMessages[reasoningId] = {
                      type: "reasoning",
                      id: reasoningId,
                      summary: []
                    };
                  }
                } else {
                  const summaryParts = [];
                  if (part.text.length > 0) {
                    summaryParts.push({
                      type: "summary_text",
                      text: part.text
                    });
                  } else if (reasoningMessage !== void 0) {
                    warnings.push({
                      type: "other",
                      message: `Cannot append empty reasoning part to existing reasoning sequence. Skipping reasoning part: ${JSON.stringify(part)}.`
                    });
                  }
                  if (reasoningMessage === void 0) {
                    reasoningMessages[reasoningId] = {
                      type: "reasoning",
                      id: reasoningId,
                      encrypted_content: providerOptions2?.reasoningEncryptedContent,
                      summary: summaryParts
                    };
                    input.push(reasoningMessages[reasoningId]);
                  } else {
                    reasoningMessage.summary.push(...summaryParts);
                    if (providerOptions2?.reasoningEncryptedContent != null) {
                      reasoningMessage.encrypted_content = providerOptions2.reasoningEncryptedContent;
                    }
                  }
                }
              } else {
                const encryptedContent = providerOptions2?.reasoningEncryptedContent;
                if (encryptedContent != null) {
                  const summaryParts = [];
                  if (part.text.length > 0) {
                    summaryParts.push({
                      type: "summary_text",
                      text: part.text
                    });
                  }
                  input.push({
                    type: "reasoning",
                    encrypted_content: encryptedContent,
                    summary: summaryParts
                  });
                } else {
                  warnings.push({
                    type: "other",
                    message: `Non-OpenAI reasoning parts are not supported. Skipping reasoning part: ${JSON.stringify(part)}.`
                  });
                }
              }
              break;
            }
            case "custom": {
              if (part.kind === "openai.compaction") {
                const providerOptions2 = part.providerOptions?.[providerOptionsName];
                const id = providerOptions2?.itemId;
                if (hasConversation && id != null) {
                  break;
                }
                if (store && id != null) {
                  input.push({ type: "item_reference", id });
                  break;
                }
                const encryptedContent = providerOptions2?.encryptedContent;
                if (id != null) {
                  input.push({
                    type: "compaction",
                    id,
                    encrypted_content: encryptedContent
                  });
                }
              }
              break;
            }
          }
        }
        break;
      }
      case "tool": {
        for (const part of content) {
          if (part.type === "tool-approval-response") {
            const approvalResponse = part;
            if (processedApprovalIds.has(approvalResponse.approvalId)) {
              continue;
            }
            processedApprovalIds.add(approvalResponse.approvalId);
            if (store) {
              input.push({
                type: "item_reference",
                id: approvalResponse.approvalId
              });
            }
            input.push({
              type: "mcp_approval_response",
              approval_request_id: approvalResponse.approvalId,
              approve: approvalResponse.approved
            });
            continue;
          }
          const output = part.output;
          if (output.type === "execution-denied") {
            const approvalId = output.providerOptions?.openai?.approvalId;
            if (approvalId) {
              continue;
            }
          }
          const resolvedToolName = toolNameMapping.toProviderToolName(
            part.toolName
          );
          if (resolvedToolName === "tool_search" && output.type === "json") {
            const parsedOutput = await validateTypes({
              value: output.value,
              schema: toolSearchOutputSchema
            });
            input.push({
              type: "tool_search_output",
              execution: "client",
              call_id: part.toolCallId,
              status: "completed",
              tools: parsedOutput.tools
            });
            continue;
          }
          if (hasLocalShellTool && resolvedToolName === "local_shell" && output.type === "json") {
            const parsedOutput = await validateTypes({
              value: output.value,
              schema: localShellOutputSchema
            });
            input.push({
              type: "local_shell_call_output",
              call_id: part.toolCallId,
              output: parsedOutput.output
            });
            continue;
          }
          if (hasShellTool && resolvedToolName === "shell" && output.type === "json") {
            const parsedOutput = await validateTypes({
              value: output.value,
              schema: shellOutputSchema
            });
            input.push({
              type: "shell_call_output",
              call_id: part.toolCallId,
              output: parsedOutput.output.map((item) => ({
                stdout: item.stdout,
                stderr: item.stderr,
                outcome: item.outcome.type === "timeout" ? { type: "timeout" } : {
                  type: "exit",
                  exit_code: item.outcome.exitCode
                }
              }))
            });
            continue;
          }
          if (hasApplyPatchTool && part.toolName === "apply_patch" && output.type === "json") {
            const parsedOutput = await validateTypes({
              value: output.value,
              schema: applyPatchOutputSchema
            });
            input.push({
              type: "apply_patch_call_output",
              call_id: part.toolCallId,
              status: parsedOutput.status,
              output: parsedOutput.output
            });
            continue;
          }
          if (hasComputerTool && resolvedToolName === "computer" && output.type === "json") {
            const parsedOutput = await validateTypes({
              value: output.value,
              schema: computerOutputSchema
            });
            input.push({
              type: "computer_call_output",
              call_id: part.toolCallId,
              output: {
                type: "computer_screenshot",
                image_url: parsedOutput.output.imageUrl,
                file_id: parsedOutput.output.fileId,
                detail: parsedOutput.output.detail
              },
              acknowledged_safety_checks: parsedOutput.acknowledgedSafetyChecks?.map((safetyCheck) => ({
                id: safetyCheck.id,
                code: safetyCheck.code,
                message: safetyCheck.message
              }))
            });
            continue;
          }
          if (customProviderToolNames?.has(resolvedToolName)) {
            let outputValue;
            switch (output.type) {
              case "text":
              case "error-text":
                outputValue = output.value;
                break;
              case "execution-denied":
                outputValue = output.reason ?? "Tool call execution denied.";
                break;
              case "json":
              case "error-json":
                outputValue = JSON.stringify(output.value);
                break;
              case "content":
                outputValue = output.value.map((item) => {
                  const promptCacheBreakpoint = getPromptCacheBreakpoint2(
                    item.providerOptions,
                    providerOptionsName
                  );
                  switch (item.type) {
                    case "text":
                      return {
                        type: "input_text",
                        text: item.text,
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    case "file": {
                      const topLevel = getTopLevelMediaType2(item.mediaType);
                      const imageDetail = item.providerOptions?.[providerOptionsName]?.imageDetail;
                      if (item.data.type === "data") {
                        const fullMediaType = resolveFullMediaType2({
                          part: item
                        });
                        if (topLevel === "image") {
                          return {
                            type: "input_image",
                            image_url: `data:${fullMediaType};base64,${convertToBase642(item.data.data)}`,
                            detail: imageDetail,
                            ...promptCacheBreakpoint != null && {
                              prompt_cache_breakpoint: promptCacheBreakpoint
                            }
                          };
                        }
                        return {
                          type: "input_file",
                          filename: item.filename ?? "data",
                          file_data: `data:${fullMediaType};base64,${convertToBase642(item.data.data)}`,
                          ...promptCacheBreakpoint != null && {
                            prompt_cache_breakpoint: promptCacheBreakpoint
                          }
                        };
                      }
                      if (item.data.type === "url") {
                        if (topLevel === "image") {
                          return {
                            type: "input_image",
                            image_url: item.data.url.toString(),
                            detail: imageDetail,
                            ...promptCacheBreakpoint != null && {
                              prompt_cache_breakpoint: promptCacheBreakpoint
                            }
                          };
                        }
                        return {
                          type: "input_file",
                          file_url: item.data.url.toString(),
                          ...promptCacheBreakpoint != null && {
                            prompt_cache_breakpoint: promptCacheBreakpoint
                          }
                        };
                      }
                      warnings.push({
                        type: "other",
                        message: `unsupported custom tool content part type: ${item.type} with data type: ${item.data.type}`
                      });
                      return void 0;
                    }
                    default:
                      warnings.push({
                        type: "other",
                        message: `unsupported custom tool content part type: ${item.type}`
                      });
                      return void 0;
                  }
                }).filter(isNonNullable);
                break;
              default:
                outputValue = "";
            }
            input.push({
              type: "custom_tool_call_output",
              call_id: part.toolCallId,
              output: outputValue
            });
            continue;
          }
          let contentValue;
          const hasOutputSchema = outputSchemaToolNames?.has(part.toolName);
          switch (output.type) {
            case "text":
            case "error-text":
              contentValue = hasOutputSchema ? JSON.stringify(output.value) : output.value;
              break;
            case "execution-denied": {
              const reason = output.reason ?? "Tool call execution denied.";
              contentValue = hasOutputSchema ? JSON.stringify(reason) : reason;
              break;
            }
            case "json":
            case "error-json":
              contentValue = JSON.stringify(output.value);
              break;
            case "content":
              contentValue = output.value.map((item) => {
                const promptCacheBreakpoint = getPromptCacheBreakpoint2(
                  item.providerOptions,
                  providerOptionsName
                );
                switch (item.type) {
                  case "text": {
                    return {
                      type: "input_text",
                      text: item.text,
                      ...promptCacheBreakpoint != null && {
                        prompt_cache_breakpoint: promptCacheBreakpoint
                      }
                    };
                  }
                  case "file": {
                    const topLevel = getTopLevelMediaType2(item.mediaType);
                    const imageDetail = item.providerOptions?.[providerOptionsName]?.imageDetail;
                    if (item.data.type === "data") {
                      const fullMediaType = resolveFullMediaType2({
                        part: item
                      });
                      if (topLevel === "image") {
                        return {
                          type: "input_image",
                          image_url: `data:${fullMediaType};base64,${convertToBase642(item.data.data)}`,
                          detail: imageDetail,
                          ...promptCacheBreakpoint != null && {
                            prompt_cache_breakpoint: promptCacheBreakpoint
                          }
                        };
                      }
                      return {
                        type: "input_file",
                        filename: item.filename ?? "data",
                        file_data: `data:${fullMediaType};base64,${convertToBase642(item.data.data)}`,
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    }
                    if (item.data.type === "url") {
                      if (topLevel === "image") {
                        return {
                          type: "input_image",
                          image_url: item.data.url.toString(),
                          detail: imageDetail,
                          ...promptCacheBreakpoint != null && {
                            prompt_cache_breakpoint: promptCacheBreakpoint
                          }
                        };
                      }
                      return {
                        type: "input_file",
                        file_url: item.data.url.toString(),
                        ...promptCacheBreakpoint != null && {
                          prompt_cache_breakpoint: promptCacheBreakpoint
                        }
                      };
                    }
                    warnings.push({
                      type: "other",
                      message: `unsupported tool content part type: ${item.type} with data type: ${item.data.type}`
                    });
                    return void 0;
                  }
                  default: {
                    warnings.push({
                      type: "other",
                      message: `unsupported tool content part type: ${item.type}`
                    });
                    return void 0;
                  }
                }
              }).filter(isNonNullable);
              break;
          }
          const caller = mapToolCaller(
            part.providerOptions?.[providerOptionsName]?.caller
          );
          input.push({
            type: "function_call_output",
            call_id: part.toolCallId,
            output: contentValue,
            ...caller != null && { caller }
          });
        }
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  if ((!store || avoidReasoningItemReferences) && input.some(
    (item) => "type" in item && item.type === "reasoning" && item.encrypted_content == null
  )) {
    warnings.push({
      type: "other",
      message: "Reasoning parts without encrypted content are not supported when item references are disabled. Skipping reasoning parts."
    });
    input = input.filter(
      (item) => !("type" in item) || item.type !== "reasoning" || item.encrypted_content != null
    );
  }
  return { input, warnings };
}
var openaiResponsesReasoningProviderOptionsSchema = z21.object({
  itemId: z21.string().nullish(),
  reasoningEncryptedContent: z21.string().nullish()
});

// src/responses/map-openai-responses-finish-reason.ts
function mapOpenAIResponseFinishReason({
  finishReason,
  hasFunctionCall
}) {
  switch (finishReason) {
    case void 0:
    case null:
      return hasFunctionCall ? "tool-calls" : "stop";
    case "max_output_tokens":
      return "length";
    case "content_filter":
      return "content-filter";
    default:
      return hasFunctionCall ? "tool-calls" : "other";
  }
}

// src/responses/openai-responses-api.ts
import {
  lazySchema as lazySchema20,
  zodSchema as zodSchema20
} from "@ai-sdk/provider-utils";
import { z as z22 } from "zod/v4";
var jsonValueSchema = z22.lazy(
  () => z22.union([
    z22.string(),
    z22.number(),
    z22.boolean(),
    z22.null(),
    z22.array(jsonValueSchema),
    z22.record(z22.string(), jsonValueSchema.optional())
  ])
);
var openaiResponsesComputerSafetyCheckSchema = z22.object({
  id: z22.string(),
  code: z22.string().nullish(),
  message: z22.string().nullish()
});
var openaiResponsesComputerActionSchema = z22.discriminatedUnion("type", [
  z22.object({
    type: z22.literal("click"),
    button: z22.enum(["left", "right", "wheel", "back", "forward"]),
    x: z22.number(),
    y: z22.number(),
    keys: z22.array(z22.string()).nullish()
  }),
  z22.object({
    type: z22.literal("double_click"),
    x: z22.number(),
    y: z22.number(),
    keys: z22.array(z22.string()).nullish()
  }),
  z22.object({
    type: z22.literal("drag"),
    path: z22.array(z22.object({ x: z22.number(), y: z22.number() })),
    keys: z22.array(z22.string()).nullish()
  }),
  z22.object({
    type: z22.literal("keypress"),
    keys: z22.array(z22.string())
  }),
  z22.object({
    type: z22.literal("move"),
    x: z22.number(),
    y: z22.number(),
    keys: z22.array(z22.string()).nullish()
  }),
  z22.object({
    type: z22.literal("screenshot")
  }),
  z22.object({
    type: z22.literal("scroll"),
    x: z22.number(),
    y: z22.number(),
    scroll_x: z22.number(),
    scroll_y: z22.number(),
    keys: z22.array(z22.string()).nullish()
  }),
  z22.object({
    type: z22.literal("type"),
    text: z22.string()
  }),
  z22.object({
    type: z22.literal("wait")
  })
]);
var openaiResponsesComputerCallSchema = z22.object({
  type: z22.literal("computer_call"),
  id: z22.string(),
  call_id: z22.string().nullish(),
  status: z22.enum(["in_progress", "completed", "incomplete"]),
  action: openaiResponsesComputerActionSchema.nullish(),
  actions: z22.array(openaiResponsesComputerActionSchema).nullish(),
  pending_safety_checks: z22.array(openaiResponsesComputerSafetyCheckSchema).nullish()
});
var openaiResponsesToolCallerSchema = z22.discriminatedUnion("type", [
  z22.object({ type: z22.literal("direct") }),
  z22.object({
    type: z22.literal("program"),
    caller_id: z22.string()
  })
]);
var openaiResponsesProgramSchema = z22.object({
  type: z22.literal("program"),
  id: z22.string(),
  call_id: z22.string(),
  code: z22.string(),
  fingerprint: z22.string()
});
var openaiResponsesProgramOutputSchema = z22.object({
  type: z22.literal("program_output"),
  id: z22.string(),
  call_id: z22.string(),
  result: z22.string(),
  status: z22.enum(["completed", "incomplete"])
});
var openaiResponsesNestedErrorChunkSchema = z22.object({
  type: z22.literal("error"),
  sequence_number: z22.number(),
  error: z22.object({
    type: z22.string(),
    code: z22.string(),
    message: z22.string(),
    param: z22.string().nullish()
  })
});
var openaiResponsesErrorChunkSchema = z22.object({
  type: z22.literal("error"),
  sequence_number: z22.number(),
  code: z22.string().nullish(),
  message: z22.string(),
  param: z22.string().nullish()
});
var openaiResponsesChunkSchema = lazySchema20(
  () => zodSchema20(
    z22.union([
      z22.object({
        type: z22.literal("response.output_text.delta"),
        item_id: z22.string(),
        output_index: z22.number().nullish(),
        delta: z22.string(),
        logprobs: z22.array(
          z22.object({
            token: z22.string(),
            logprob: z22.number(),
            top_logprobs: z22.array(
              z22.object({
                token: z22.string(),
                logprob: z22.number()
              })
            )
          })
        ).nullish()
      }),
      z22.object({
        type: z22.enum(["response.completed", "response.incomplete"]),
        response: z22.object({
          incomplete_details: z22.object({ reason: z22.string() }).nullish(),
          usage: z22.object({
            input_tokens: z22.number(),
            input_tokens_details: z22.object({
              cached_tokens: z22.number().nullish(),
              cache_write_tokens: z22.number().nullish(),
              orchestration_input_tokens: z22.number().nullish(),
              orchestration_input_cached_tokens: z22.number().nullish()
            }).nullish(),
            output_tokens: z22.number(),
            output_tokens_details: z22.object({
              reasoning_tokens: z22.number().nullish(),
              orchestration_output_tokens: z22.number().nullish()
            }).nullish()
          }),
          reasoning: z22.object({
            context: z22.string().nullish()
          }).nullish(),
          service_tier: z22.string().nullish()
        })
      }),
      z22.object({
        type: z22.literal("response.failed"),
        sequence_number: z22.number(),
        response: z22.object({
          error: z22.object({
            code: z22.string().nullish(),
            message: z22.string()
          }).nullish(),
          incomplete_details: z22.object({ reason: z22.string() }).nullish(),
          usage: z22.object({
            input_tokens: z22.number(),
            input_tokens_details: z22.object({
              cached_tokens: z22.number().nullish(),
              cache_write_tokens: z22.number().nullish(),
              orchestration_input_tokens: z22.number().nullish(),
              orchestration_input_cached_tokens: z22.number().nullish()
            }).nullish(),
            output_tokens: z22.number(),
            output_tokens_details: z22.object({
              reasoning_tokens: z22.number().nullish(),
              orchestration_output_tokens: z22.number().nullish()
            }).nullish()
          }).nullish(),
          reasoning: z22.object({
            context: z22.string().nullish()
          }).nullish(),
          service_tier: z22.string().nullish()
        })
      }),
      z22.object({
        type: z22.literal("response.created"),
        response: z22.object({
          id: z22.string(),
          created_at: z22.number(),
          model: z22.string(),
          service_tier: z22.string().nullish()
        })
      }),
      z22.object({
        type: z22.literal("response.in_progress"),
        response: z22.object({
          id: z22.string(),
          created_at: z22.number(),
          model: z22.string(),
          service_tier: z22.string().nullish()
        })
      }),
      z22.object({
        type: z22.literal("response.output_item.added"),
        output_index: z22.number(),
        item: z22.discriminatedUnion("type", [
          z22.object({
            type: z22.literal("message"),
            id: z22.string(),
            phase: z22.enum(["commentary", "final_answer"]).nullish()
          }),
          z22.object({
            type: z22.literal("reasoning"),
            id: z22.string(),
            encrypted_content: z22.string().nullish()
          }),
          z22.object({
            type: z22.literal("function_call"),
            id: z22.string(),
            call_id: z22.string(),
            name: z22.string(),
            arguments: z22.string(),
            namespace: z22.string().nullish(),
            caller: openaiResponsesToolCallerSchema.nullish()
          }),
          openaiResponsesProgramSchema,
          openaiResponsesProgramOutputSchema,
          z22.object({
            type: z22.literal("web_search_call"),
            id: z22.string(),
            status: z22.string()
          }),
          openaiResponsesComputerCallSchema,
          z22.object({
            type: z22.literal("file_search_call"),
            id: z22.string()
          }),
          z22.object({
            type: z22.literal("image_generation_call"),
            id: z22.string()
          }),
          z22.object({
            type: z22.literal("code_interpreter_call"),
            id: z22.string(),
            container_id: z22.string(),
            code: z22.string().nullable(),
            outputs: z22.array(
              z22.discriminatedUnion("type", [
                z22.object({ type: z22.literal("logs"), logs: z22.string() }),
                z22.object({ type: z22.literal("image"), url: z22.string() })
              ])
            ).nullable(),
            status: z22.string()
          }),
          z22.object({
            type: z22.literal("mcp_call"),
            id: z22.string(),
            status: z22.string(),
            approval_request_id: z22.string().nullish()
          }),
          z22.object({
            type: z22.literal("mcp_list_tools"),
            id: z22.string()
          }),
          z22.object({
            type: z22.literal("mcp_approval_request"),
            id: z22.string()
          }),
          z22.object({
            type: z22.literal("apply_patch_call"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed"]),
            operation: z22.discriminatedUnion("type", [
              z22.object({
                type: z22.literal("create_file"),
                path: z22.string(),
                diff: z22.string()
              }),
              z22.object({
                type: z22.literal("delete_file"),
                path: z22.string()
              }),
              z22.object({
                type: z22.literal("update_file"),
                path: z22.string(),
                diff: z22.string()
              })
            ])
          }),
          z22.object({
            type: z22.literal("custom_tool_call"),
            id: z22.string(),
            call_id: z22.string(),
            name: z22.string(),
            input: z22.string()
          }),
          z22.object({
            type: z22.literal("shell_call"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            action: z22.object({
              commands: z22.array(z22.string())
            })
          }),
          z22.object({
            type: z22.literal("compaction"),
            id: z22.string(),
            encrypted_content: z22.string().nullish()
          }),
          z22.object({
            type: z22.literal("shell_call_output"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            output: z22.array(
              z22.object({
                stdout: z22.string(),
                stderr: z22.string(),
                outcome: z22.discriminatedUnion("type", [
                  z22.object({ type: z22.literal("timeout") }),
                  z22.object({
                    type: z22.literal("exit"),
                    exit_code: z22.number()
                  })
                ])
              })
            )
          }),
          z22.object({
            type: z22.literal("tool_search_call"),
            id: z22.string(),
            execution: z22.enum(["server", "client"]),
            call_id: z22.string().nullable(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            arguments: z22.unknown()
          }),
          z22.object({
            type: z22.literal("tool_search_output"),
            id: z22.string(),
            execution: z22.enum(["server", "client"]),
            call_id: z22.string().nullable(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            tools: z22.array(z22.record(z22.string(), jsonValueSchema.optional()))
          })
        ])
      }),
      z22.object({
        type: z22.literal("response.output_item.done"),
        output_index: z22.number(),
        item: z22.discriminatedUnion("type", [
          z22.object({
            type: z22.literal("message"),
            id: z22.string(),
            phase: z22.enum(["commentary", "final_answer"]).nullish()
          }),
          z22.object({
            type: z22.literal("reasoning"),
            id: z22.string(),
            encrypted_content: z22.string().nullish()
          }),
          z22.object({
            type: z22.literal("function_call"),
            id: z22.string(),
            call_id: z22.string(),
            name: z22.string(),
            arguments: z22.string(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            namespace: z22.string().nullish(),
            caller: openaiResponsesToolCallerSchema.nullish()
          }),
          openaiResponsesProgramSchema,
          openaiResponsesProgramOutputSchema,
          z22.object({
            type: z22.literal("custom_tool_call"),
            id: z22.string(),
            call_id: z22.string(),
            name: z22.string(),
            input: z22.string(),
            status: z22.literal("completed")
          }),
          z22.object({
            type: z22.literal("code_interpreter_call"),
            id: z22.string(),
            code: z22.string().nullable(),
            container_id: z22.string(),
            outputs: z22.array(
              z22.discriminatedUnion("type", [
                z22.object({ type: z22.literal("logs"), logs: z22.string() }),
                z22.object({ type: z22.literal("image"), url: z22.string() })
              ])
            ).nullable()
          }),
          z22.object({
            type: z22.literal("image_generation_call"),
            id: z22.string(),
            result: z22.string()
          }),
          z22.object({
            type: z22.literal("web_search_call"),
            id: z22.string(),
            status: z22.string(),
            action: z22.discriminatedUnion("type", [
              z22.object({
                type: z22.literal("search"),
                query: z22.string().nullish(),
                queries: z22.array(z22.string()).nullish(),
                sources: z22.array(
                  z22.discriminatedUnion("type", [
                    z22.object({ type: z22.literal("url"), url: z22.string() }),
                    z22.object({ type: z22.literal("api"), name: z22.string() })
                  ])
                ).nullish()
              }),
              z22.object({
                type: z22.literal("open_page"),
                url: z22.string().nullish()
              }),
              z22.object({
                type: z22.literal("find_in_page"),
                url: z22.string().nullish(),
                pattern: z22.string().nullish()
              })
            ]).nullish()
          }),
          z22.object({
            type: z22.literal("file_search_call"),
            id: z22.string(),
            queries: z22.array(z22.string()),
            results: z22.array(
              z22.object({
                attributes: z22.record(
                  z22.string(),
                  z22.union([z22.string(), z22.number(), z22.boolean()])
                ),
                file_id: z22.string(),
                filename: z22.string(),
                score: z22.number(),
                text: z22.string()
              })
            ).nullish()
          }),
          z22.object({
            type: z22.literal("local_shell_call"),
            id: z22.string(),
            call_id: z22.string(),
            action: z22.object({
              type: z22.literal("exec"),
              command: z22.array(z22.string()),
              timeout_ms: z22.number().optional(),
              user: z22.string().optional(),
              working_directory: z22.string().optional(),
              env: z22.record(z22.string(), z22.string()).optional()
            })
          }),
          openaiResponsesComputerCallSchema,
          z22.object({
            type: z22.literal("mcp_call"),
            id: z22.string(),
            status: z22.string(),
            arguments: z22.string(),
            name: z22.string(),
            server_label: z22.string(),
            output: z22.string().nullish(),
            error: z22.union([
              z22.string(),
              z22.object({
                type: z22.string().optional(),
                code: z22.union([z22.number(), z22.string()]).optional(),
                message: z22.string().optional()
              }).loose()
            ]).nullish(),
            approval_request_id: z22.string().nullish()
          }),
          z22.object({
            type: z22.literal("mcp_list_tools"),
            id: z22.string(),
            server_label: z22.string(),
            tools: z22.array(
              z22.object({
                name: z22.string(),
                description: z22.string().optional(),
                input_schema: z22.any(),
                annotations: z22.record(z22.string(), z22.unknown()).optional()
              })
            ),
            error: z22.union([
              z22.string(),
              z22.object({
                type: z22.string().optional(),
                code: z22.union([z22.number(), z22.string()]).optional(),
                message: z22.string().optional()
              }).loose()
            ]).optional()
          }),
          z22.object({
            type: z22.literal("mcp_approval_request"),
            id: z22.string(),
            server_label: z22.string(),
            name: z22.string(),
            arguments: z22.string(),
            approval_request_id: z22.string().optional()
          }),
          z22.object({
            type: z22.literal("apply_patch_call"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed"]),
            operation: z22.discriminatedUnion("type", [
              z22.object({
                type: z22.literal("create_file"),
                path: z22.string(),
                diff: z22.string()
              }),
              z22.object({
                type: z22.literal("delete_file"),
                path: z22.string()
              }),
              z22.object({
                type: z22.literal("update_file"),
                path: z22.string(),
                diff: z22.string()
              })
            ])
          }),
          z22.object({
            type: z22.literal("shell_call"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            action: z22.object({
              commands: z22.array(z22.string())
            })
          }),
          z22.object({
            type: z22.literal("compaction"),
            id: z22.string(),
            encrypted_content: z22.string()
          }),
          z22.object({
            type: z22.literal("shell_call_output"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            output: z22.array(
              z22.object({
                stdout: z22.string(),
                stderr: z22.string(),
                outcome: z22.discriminatedUnion("type", [
                  z22.object({ type: z22.literal("timeout") }),
                  z22.object({
                    type: z22.literal("exit"),
                    exit_code: z22.number()
                  })
                ])
              })
            )
          }),
          z22.object({
            type: z22.literal("tool_search_call"),
            id: z22.string(),
            execution: z22.enum(["server", "client"]),
            call_id: z22.string().nullable(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            arguments: z22.unknown()
          }),
          z22.object({
            type: z22.literal("tool_search_output"),
            id: z22.string(),
            execution: z22.enum(["server", "client"]),
            call_id: z22.string().nullable(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            tools: z22.array(z22.record(z22.string(), jsonValueSchema.optional()))
          })
        ])
      }),
      z22.object({
        type: z22.literal("response.function_call_arguments.delta"),
        item_id: z22.string(),
        output_index: z22.number(),
        delta: z22.string()
      }),
      z22.object({
        type: z22.literal("response.custom_tool_call_input.delta"),
        item_id: z22.string(),
        output_index: z22.number(),
        delta: z22.string()
      }),
      z22.object({
        type: z22.literal("response.image_generation_call.partial_image"),
        item_id: z22.string(),
        output_index: z22.number(),
        partial_image_b64: z22.string()
      }),
      z22.object({
        type: z22.literal("response.code_interpreter_call_code.delta"),
        item_id: z22.string(),
        output_index: z22.number(),
        delta: z22.string()
      }),
      z22.object({
        type: z22.literal("response.code_interpreter_call_code.done"),
        item_id: z22.string(),
        output_index: z22.number(),
        code: z22.string()
      }),
      z22.object({
        type: z22.literal("response.output_text.annotation.added"),
        annotation: z22.discriminatedUnion("type", [
          z22.object({
            type: z22.literal("url_citation"),
            start_index: z22.number(),
            end_index: z22.number(),
            url: z22.string(),
            title: z22.string()
          }),
          z22.object({
            type: z22.literal("file_citation"),
            file_id: z22.string(),
            filename: z22.string(),
            index: z22.number()
          }),
          z22.object({
            type: z22.literal("container_file_citation"),
            container_id: z22.string(),
            file_id: z22.string(),
            filename: z22.string(),
            start_index: z22.number(),
            end_index: z22.number()
          }),
          z22.object({
            type: z22.literal("file_path"),
            file_id: z22.string(),
            index: z22.number()
          })
        ])
      }),
      z22.object({
        type: z22.literal("response.reasoning_summary_part.added"),
        item_id: z22.string(),
        output_index: z22.number().nullish(),
        summary_index: z22.number()
      }),
      z22.object({
        type: z22.literal("response.reasoning_summary_text.delta"),
        item_id: z22.string(),
        output_index: z22.number().nullish(),
        summary_index: z22.number(),
        delta: z22.string()
      }),
      z22.object({
        type: z22.literal("response.reasoning_summary_part.done"),
        item_id: z22.string(),
        output_index: z22.number().nullish(),
        summary_index: z22.number()
      }),
      z22.object({
        type: z22.literal("response.apply_patch_call_operation_diff.delta"),
        item_id: z22.string(),
        output_index: z22.number(),
        delta: z22.string(),
        obfuscation: z22.string().nullish()
      }),
      z22.object({
        type: z22.literal("response.apply_patch_call_operation_diff.done"),
        item_id: z22.string(),
        output_index: z22.number(),
        diff: z22.string()
      }),
      openaiResponsesNestedErrorChunkSchema,
      openaiResponsesErrorChunkSchema,
      z22.object({ type: z22.string() }).loose().transform((value) => ({
        type: "unknown_chunk",
        message: value.type
      }))
      // fallback for unknown chunks
    ])
  )
);
var openaiResponsesResponseSchema = lazySchema20(
  () => zodSchema20(
    z22.object({
      id: z22.string().optional(),
      created_at: z22.number().optional(),
      error: z22.object({
        message: z22.string(),
        type: z22.string(),
        param: z22.string().nullish(),
        code: z22.string()
      }).nullish(),
      model: z22.string().optional(),
      output: z22.array(
        z22.discriminatedUnion("type", [
          z22.object({
            type: z22.literal("message"),
            role: z22.literal("assistant"),
            id: z22.string(),
            phase: z22.enum(["commentary", "final_answer"]).nullish(),
            content: z22.array(
              z22.object({
                type: z22.literal("output_text"),
                text: z22.string(),
                logprobs: z22.array(
                  z22.object({
                    token: z22.string(),
                    logprob: z22.number(),
                    top_logprobs: z22.array(
                      z22.object({
                        token: z22.string(),
                        logprob: z22.number()
                      })
                    )
                  })
                ).nullish(),
                annotations: z22.array(
                  z22.discriminatedUnion("type", [
                    z22.object({
                      type: z22.literal("url_citation"),
                      start_index: z22.number(),
                      end_index: z22.number(),
                      url: z22.string(),
                      title: z22.string()
                    }),
                    z22.object({
                      type: z22.literal("file_citation"),
                      file_id: z22.string(),
                      filename: z22.string(),
                      index: z22.number()
                    }),
                    z22.object({
                      type: z22.literal("container_file_citation"),
                      container_id: z22.string(),
                      file_id: z22.string(),
                      filename: z22.string(),
                      start_index: z22.number(),
                      end_index: z22.number()
                    }),
                    z22.object({
                      type: z22.literal("file_path"),
                      file_id: z22.string(),
                      index: z22.number()
                    })
                  ])
                )
              })
            )
          }),
          z22.object({
            type: z22.literal("web_search_call"),
            id: z22.string(),
            status: z22.string(),
            action: z22.discriminatedUnion("type", [
              z22.object({
                type: z22.literal("search"),
                query: z22.string().nullish(),
                queries: z22.array(z22.string()).nullish(),
                sources: z22.array(
                  z22.discriminatedUnion("type", [
                    z22.object({ type: z22.literal("url"), url: z22.string() }),
                    z22.object({
                      type: z22.literal("api"),
                      name: z22.string()
                    })
                  ])
                ).nullish()
              }),
              z22.object({
                type: z22.literal("open_page"),
                url: z22.string().nullish()
              }),
              z22.object({
                type: z22.literal("find_in_page"),
                url: z22.string().nullish(),
                pattern: z22.string().nullish()
              })
            ]).nullish()
          }),
          z22.object({
            type: z22.literal("file_search_call"),
            id: z22.string(),
            queries: z22.array(z22.string()),
            results: z22.array(
              z22.object({
                attributes: z22.record(
                  z22.string(),
                  z22.union([z22.string(), z22.number(), z22.boolean()])
                ),
                file_id: z22.string(),
                filename: z22.string(),
                score: z22.number(),
                text: z22.string()
              })
            ).nullish()
          }),
          z22.object({
            type: z22.literal("code_interpreter_call"),
            id: z22.string(),
            code: z22.string().nullable(),
            container_id: z22.string(),
            outputs: z22.array(
              z22.discriminatedUnion("type", [
                z22.object({ type: z22.literal("logs"), logs: z22.string() }),
                z22.object({ type: z22.literal("image"), url: z22.string() })
              ])
            ).nullable()
          }),
          z22.object({
            type: z22.literal("image_generation_call"),
            id: z22.string(),
            result: z22.string()
          }),
          z22.object({
            type: z22.literal("local_shell_call"),
            id: z22.string(),
            call_id: z22.string(),
            action: z22.object({
              type: z22.literal("exec"),
              command: z22.array(z22.string()),
              timeout_ms: z22.number().optional(),
              user: z22.string().optional(),
              working_directory: z22.string().optional(),
              env: z22.record(z22.string(), z22.string()).optional()
            })
          }),
          z22.object({
            type: z22.literal("function_call"),
            call_id: z22.string(),
            name: z22.string(),
            arguments: z22.string(),
            id: z22.string(),
            namespace: z22.string().nullish(),
            caller: openaiResponsesToolCallerSchema.nullish()
          }),
          openaiResponsesProgramSchema,
          openaiResponsesProgramOutputSchema,
          z22.object({
            type: z22.literal("custom_tool_call"),
            call_id: z22.string(),
            name: z22.string(),
            input: z22.string(),
            id: z22.string()
          }),
          openaiResponsesComputerCallSchema,
          z22.object({
            type: z22.literal("reasoning"),
            id: z22.string(),
            encrypted_content: z22.string().nullish(),
            summary: z22.array(
              z22.object({
                type: z22.literal("summary_text"),
                text: z22.string()
              })
            )
          }),
          z22.object({
            type: z22.literal("mcp_call"),
            id: z22.string(),
            status: z22.string(),
            arguments: z22.string(),
            name: z22.string(),
            server_label: z22.string(),
            output: z22.string().nullish(),
            error: z22.union([
              z22.string(),
              z22.object({
                type: z22.string().optional(),
                code: z22.union([z22.number(), z22.string()]).optional(),
                message: z22.string().optional()
              }).loose()
            ]).nullish(),
            approval_request_id: z22.string().nullish()
          }),
          z22.object({
            type: z22.literal("mcp_list_tools"),
            id: z22.string(),
            server_label: z22.string(),
            tools: z22.array(
              z22.object({
                name: z22.string(),
                description: z22.string().optional(),
                input_schema: z22.any(),
                annotations: z22.record(z22.string(), z22.unknown()).optional()
              })
            ),
            error: z22.union([
              z22.string(),
              z22.object({
                type: z22.string().optional(),
                code: z22.union([z22.number(), z22.string()]).optional(),
                message: z22.string().optional()
              }).loose()
            ]).optional()
          }),
          z22.object({
            type: z22.literal("mcp_approval_request"),
            id: z22.string(),
            server_label: z22.string(),
            name: z22.string(),
            arguments: z22.string(),
            approval_request_id: z22.string().optional()
          }),
          z22.object({
            type: z22.literal("apply_patch_call"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed"]),
            operation: z22.discriminatedUnion("type", [
              z22.object({
                type: z22.literal("create_file"),
                path: z22.string(),
                diff: z22.string()
              }),
              z22.object({
                type: z22.literal("delete_file"),
                path: z22.string()
              }),
              z22.object({
                type: z22.literal("update_file"),
                path: z22.string(),
                diff: z22.string()
              })
            ])
          }),
          z22.object({
            type: z22.literal("shell_call"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            action: z22.object({
              commands: z22.array(z22.string())
            })
          }),
          z22.object({
            type: z22.literal("compaction"),
            id: z22.string(),
            encrypted_content: z22.string()
          }),
          z22.object({
            type: z22.literal("shell_call_output"),
            id: z22.string(),
            call_id: z22.string(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            output: z22.array(
              z22.object({
                stdout: z22.string(),
                stderr: z22.string(),
                outcome: z22.discriminatedUnion("type", [
                  z22.object({ type: z22.literal("timeout") }),
                  z22.object({
                    type: z22.literal("exit"),
                    exit_code: z22.number()
                  })
                ])
              })
            )
          }),
          z22.object({
            type: z22.literal("tool_search_call"),
            id: z22.string(),
            execution: z22.enum(["server", "client"]),
            call_id: z22.string().nullable(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            arguments: z22.unknown()
          }),
          z22.object({
            type: z22.literal("tool_search_output"),
            id: z22.string(),
            execution: z22.enum(["server", "client"]),
            call_id: z22.string().nullable(),
            status: z22.enum(["in_progress", "completed", "incomplete"]),
            tools: z22.array(z22.record(z22.string(), jsonValueSchema.optional()))
          })
        ])
      ).optional(),
      service_tier: z22.string().nullish(),
      reasoning: z22.object({
        context: z22.string().nullish()
      }).nullish(),
      incomplete_details: z22.object({ reason: z22.string() }).nullish(),
      usage: z22.object({
        input_tokens: z22.number(),
        input_tokens_details: z22.object({
          cached_tokens: z22.number().nullish(),
          cache_write_tokens: z22.number().nullish(),
          orchestration_input_tokens: z22.number().nullish(),
          orchestration_input_cached_tokens: z22.number().nullish()
        }).nullish(),
        output_tokens: z22.number(),
        output_tokens_details: z22.object({
          reasoning_tokens: z22.number().nullish(),
          orchestration_output_tokens: z22.number().nullish()
        }).nullish()
      }).optional()
    })
  )
);

// src/responses/openai-responses-language-model-options.ts
import {
  lazySchema as lazySchema21,
  zodSchema as zodSchema21
} from "@ai-sdk/provider-utils";
import { z as z23 } from "zod/v4";
var TOP_LOGPROBS_MAX = 20;
var openaiResponsesReasoningModelIds = [
  "o1",
  "o1-2024-12-17",
  "o3",
  "o3-2025-04-16",
  "o3-mini",
  "o3-mini-2025-01-31",
  "o4-mini",
  "o4-mini-2025-04-16",
  "gpt-5",
  "gpt-5-2025-08-07",
  "gpt-5-codex",
  "gpt-5-mini",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano",
  "gpt-5-nano-2025-08-07",
  "gpt-5-pro",
  "gpt-5-pro-2025-10-06",
  "gpt-5.1",
  "gpt-5.1-chat-latest",
  "gpt-5.1-codex-mini",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max",
  "gpt-5.2",
  "gpt-5.2-chat-latest",
  "gpt-5.2-pro",
  "gpt-5.2-codex",
  "gpt-5.3-chat-latest",
  "gpt-5.3-codex",
  "gpt-5.4",
  "gpt-5.4-2026-03-05",
  "gpt-5.4-mini",
  "gpt-5.4-mini-2026-03-17",
  "gpt-5.4-nano",
  "gpt-5.4-nano-2026-03-17",
  "gpt-5.4-pro",
  "gpt-5.4-pro-2026-03-05",
  "gpt-5.5",
  "gpt-5.5-2026-04-23",
  "gpt-5.6",
  "gpt-5.6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-terra"
];
var openaiResponsesModelIds = [
  "gpt-4.1",
  "gpt-4.1-2025-04-14",
  "gpt-4.1-mini",
  "gpt-4.1-mini-2025-04-14",
  "gpt-4.1-nano",
  "gpt-4.1-nano-2025-04-14",
  "gpt-4o",
  "gpt-4o-2024-05-13",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-11-20",
  "gpt-4o-audio-preview",
  "gpt-4o-audio-preview-2024-12-17",
  "gpt-4o-search-preview",
  "gpt-4o-search-preview-2025-03-11",
  "gpt-4o-mini-search-preview",
  "gpt-4o-mini-search-preview-2025-03-11",
  "gpt-4o-mini",
  "gpt-4o-mini-2024-07-18",
  "gpt-3.5-turbo-0125",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-1106",
  "gpt-5-chat-latest",
  ...openaiResponsesReasoningModelIds
];
var openaiLanguageModelResponsesOptionsSchema = lazySchema21(
  () => zodSchema21(
    z23.object({
      /**
       * The ID of the OpenAI Conversation to continue.
       * You must create a conversation first via the OpenAI API.
       * Cannot be used in conjunction with `previousResponseId`.
       * Defaults to `undefined`.
       * @see https://platform.openai.com/docs/api-reference/conversations/create
       */
      conversation: z23.string().nullish(),
      /**
       * The set of extra fields to include in the response (advanced, usually not needed).
       * Example values: 'reasoning.encrypted_content', 'file_search_call.results', 'web_search_call.results', 'message.output_text.logprobs'.
       */
      include: z23.array(
        z23.enum([
          "reasoning.encrypted_content",
          // handled internally by default, only needed for unknown reasoning models
          "file_search_call.results",
          "web_search_call.results",
          "message.output_text.logprobs"
        ])
      ).nullish(),
      /**
       * Instructions for the model.
       * They can be used to change the system or developer message when continuing a conversation using the `previousResponseId` option.
       * Defaults to `undefined`.
       */
      instructions: z23.string().nullish(),
      /**
       * Return the log probabilities of the tokens. Including logprobs will increase
       * the response size and can slow down response times. However, it can
       * be useful to better understand how the model is behaving.
       *
       * Setting to true will return the log probabilities of the tokens that
       * were generated.
       *
       * Setting to a number will return the log probabilities of the top n
       * tokens that were generated.
       *
       * @see https://platform.openai.com/docs/api-reference/responses/create
       * @see https://cookbook.openai.com/examples/using_logprobs
       */
      logprobs: z23.union([z23.boolean(), z23.number().min(1).max(TOP_LOGPROBS_MAX)]).optional(),
      /**
       * The maximum number of total calls to built-in tools that can be processed in a response.
       * This maximum number applies across all built-in tool calls, not per individual tool.
       * Any further attempts to call a tool by the model will be ignored.
       */
      maxToolCalls: z23.number().nullish(),
      /**
       * Additional metadata to store with the generation.
       */
      metadata: z23.any().nullish(),
      /**
       * Whether to use parallel tool calls. Defaults to `true`.
       */
      parallelToolCalls: z23.boolean().nullish(),
      /**
       * The ID of the previous response. You can use it to continue a conversation.
       * Defaults to `undefined`.
       */
      previousResponseId: z23.string().nullish(),
      /**
       * Sets a cache key to tie this prompt to cached prefixes for better caching performance.
       */
      promptCacheKey: z23.string().nullish(),
      /**
       * Prompt cache behavior for GPT-5.6 and later models.
       * `mode` controls whether OpenAI also places an implicit breakpoint.
       * `ttl` sets the minimum cache lifetime and currently only supports 30 minutes.
       */
      promptCacheOptions: z23.object({
        mode: z23.enum(["implicit", "explicit"]).optional(),
        ttl: z23.literal("30m").optional()
      }).optional(),
      /**
       * The retention policy for the prompt cache.
       * - 'in_memory': Default. Standard prompt caching behavior.
       * - '24h': Extended prompt caching that keeps cached prefixes active for up to 24 hours.
       *          Available for models before GPT-5.6 that support extended caching.
       *
       * @deprecated For GPT-5.6 and later models, use `promptCacheOptions.ttl`.
       *
       * @default 'in_memory'
       */
      promptCacheRetention: z23.enum(["in_memory", "24h"]).nullish(),
      /**
       * Reasoning effort for reasoning models. Defaults to `medium`. If you use
       * `providerOptions` to set the `reasoningEffort` option, this model setting will be ignored.
       * GPT-5.6 supports 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'.
       * Supported values vary by model.
       */
      reasoningEffort: z23.string().nullish(),
      /**
       * Controls how much model work GPT-5.6 performs before returning a final answer.
       * `standard` is the default. `pro` increases quality, latency, and token usage.
       */
      reasoningMode: z23.enum(["standard", "pro"]).optional(),
      /**
       * Controls which available reasoning items GPT-5.6 can use.
       * `auto` uses the model default, `current_turn` excludes reasoning from earlier
       * turns, and `all_turns` makes compatible earlier reasoning available.
       */
      reasoningContext: z23.enum(["auto", "current_turn", "all_turns"]).optional(),
      /**
       * Controls reasoning summary output from the model.
       * Set to "auto" to automatically receive the richest level available,
       * or "detailed" for comprehensive summaries.
       */
      reasoningSummary: z23.string().nullish(),
      /**
       * The identifier for safety monitoring and tracking.
       */
      safetyIdentifier: z23.string().nullish(),
      /**
       * Service tier for the request.
       * Set to 'flex' for 50% cheaper processing at the cost of increased latency (available for o3, o4-mini, and gpt-5 models).
       * Set to 'priority' for faster processing with Enterprise access (available for gpt-4, gpt-5, gpt-5-mini, o3, o4-mini; gpt-5-nano is not supported).
       * Set to 'fast' for the same tier as 'priority' (OpenAI's newer name for it).
       *
       * Defaults to 'auto'.
       */
      serviceTier: z23.enum(["auto", "flex", "priority", "fast", "default"]).nullish(),
      /**
       * Whether to store the generation. Defaults to `true`.
       */
      store: z23.boolean().nullish(),
      /**
       * Whether to pass through non-image file types as generic input files.
       *
       * By default, inline file inputs are restricted to images and PDFs.
       * Enable this when the target OpenAI Responses model supports additional
       * file media types, such as text/csv.
       */
      passThroughUnsupportedFiles: z23.boolean().optional(),
      /**
       * Whether to use strict JSON schema validation.
       * Defaults to `true`.
       */
      strictJsonSchema: z23.boolean().nullish(),
      /**
       * Controls the verbosity of the model's responses. Lower values ('low') will result
       * in more concise responses, while higher values ('high') will result in more verbose responses.
       * Valid values: 'low', 'medium', 'high'.
       */
      textVerbosity: z23.enum(["low", "medium", "high"]).nullish(),
      /**
       * Controls output truncation. 'auto' (default) performs truncation automatically;
       * 'disabled' turns truncation off.
       */
      truncation: z23.enum(["auto", "disabled"]).nullish(),
      /**
       * A unique identifier representing your end-user, which can help OpenAI to
       * monitor and detect abuse.
       * Defaults to `undefined`.
       * @see https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids
       */
      user: z23.string().nullish(),
      /**
       * Override the system message mode for this model.
       * - 'system': Use the 'system' role for system messages (default for most models)
       * - 'developer': Use the 'developer' role for system messages (used by reasoning models)
       * - 'remove': Remove system messages entirely
       *
       * If not specified, the mode is automatically determined based on the model.
       */
      systemMessageMode: z23.enum(["system", "developer", "remove"]).optional(),
      /**
       * Force treating this model as a reasoning model.
       *
       * This is useful for "stealth" reasoning models (e.g. via a custom baseURL)
       * where the model ID is not recognized by the SDK's allowlist.
       *
       * When enabled, the SDK applies reasoning-model parameter compatibility rules
       * and defaults `systemMessageMode` to `developer` unless overridden.
       */
      forceReasoning: z23.boolean().optional(),
      /**
       * Enable server-side context management (compaction).
       */
      contextManagement: z23.array(
        z23.object({
          type: z23.literal("compaction"),
          compactThreshold: z23.number()
        })
      ).nullish(),
      /**
       * Restrict the callable tools to a subset while keeping the full tools
       * list intact, so prompt caching is preserved across requests with
       * different allowlists.
       *
       * When set, this overrides the request-level `toolChoice` and emits
       * `tool_choice: { type: "allowed_tools", mode, tools }` on the wire.
       *
       * @see https://developers.openai.com/api/reference/resources/responses/methods/create#(resource)%20responses%20%3E%20(model)%20tool_choice_allowed%20%3E%20(schema)
       */
      allowedTools: z23.object({
        toolNames: z23.array(z23.string()).min(1),
        mode: z23.enum(["auto", "required"]).optional()
      }).optional()
    })
  )
);

// src/responses/openai-responses-prepare-tools.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError5
} from "@ai-sdk/provider";
import {
  resolveProviderReference as resolveProviderReference3,
  validateTypes as validateTypes2
} from "@ai-sdk/provider-utils";

// src/tool/custom.ts
import {
  createProviderDefinedToolFactory,
  lazySchema as lazySchema22,
  zodSchema as zodSchema22
} from "@ai-sdk/provider-utils";
import { z as z24 } from "zod/v4";
var customArgsSchema = lazySchema22(
  () => zodSchema22(
    z24.object({
      description: z24.string().optional(),
      format: z24.union([
        z24.object({
          type: z24.literal("grammar"),
          syntax: z24.enum(["regex", "lark"]),
          definition: z24.string()
        }),
        z24.object({
          type: z24.literal("text")
        })
      ]).optional()
    })
  )
);
var customInputSchema = lazySchema22(() => zodSchema22(z24.string()));
var customToolFactory = createProviderDefinedToolFactory({
  id: "openai.custom",
  inputSchema: customInputSchema
});
var customTool = (args) => customToolFactory(args);

// src/tool/mcp.ts
import {
  createProviderExecutedToolFactory as createProviderExecutedToolFactory7,
  lazySchema as lazySchema23,
  zodSchema as zodSchema23
} from "@ai-sdk/provider-utils";
import { z as z25 } from "zod/v4";
var jsonValueSchema2 = z25.lazy(
  () => z25.union([
    z25.string(),
    z25.number(),
    z25.boolean(),
    z25.null(),
    z25.array(jsonValueSchema2),
    z25.record(z25.string(), jsonValueSchema2)
  ])
);
var mcpArgsSchema = lazySchema23(
  () => zodSchema23(
    z25.object({
      serverLabel: z25.string(),
      allowedTools: z25.union([
        z25.array(z25.string()),
        z25.object({
          readOnly: z25.boolean().optional(),
          toolNames: z25.array(z25.string()).optional()
        })
      ]).optional(),
      authorization: z25.string().optional(),
      connectorId: z25.string().optional(),
      headers: z25.record(z25.string(), z25.string()).optional(),
      requireApproval: z25.union([
        z25.enum(["always", "never"]),
        z25.object({
          never: z25.object({
            toolNames: z25.array(z25.string()).optional()
          }).optional()
        })
      ]).optional(),
      serverDescription: z25.string().optional(),
      serverUrl: z25.string().optional()
    }).refine(
      (v) => v.serverUrl != null || v.connectorId != null,
      "One of serverUrl or connectorId must be provided."
    )
  )
);
var mcpInputSchema = lazySchema23(() => zodSchema23(z25.object({})));
var mcpOutputSchema = lazySchema23(
  () => zodSchema23(
    z25.object({
      type: z25.literal("call"),
      serverLabel: z25.string(),
      name: z25.string(),
      arguments: z25.string(),
      output: z25.string().nullish(),
      error: z25.union([z25.string(), jsonValueSchema2]).optional()
    })
  )
);
var mcpToolFactory = createProviderExecutedToolFactory7({
  id: "openai.mcp",
  inputSchema: mcpInputSchema,
  outputSchema: mcpOutputSchema
});
var mcp = (args) => mcpToolFactory(args);

// src/responses/openai-responses-prepare-tools.ts
async function prepareResponsesTools({
  tools,
  toolChoice,
  allowedTools,
  toolNameMapping,
  customProviderToolNames,
  outputSchemaToolNames
}) {
  tools = tools?.length ? tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, toolChoice: void 0, toolWarnings };
  }
  const openaiTools = [];
  const namespaceTools = /* @__PURE__ */ new Map();
  const resolvedCustomProviderToolNames = customProviderToolNames ?? /* @__PURE__ */ new Set();
  for (const tool of tools) {
    switch (tool.type) {
      case "function": {
        const openaiOptions = tool.providerOptions?.openai;
        if (openaiOptions?.outputSchema != null) {
          outputSchemaToolNames?.add(tool.name);
        }
        const openaiFunctionTool = prepareFunctionTool({
          tool,
          options: openaiOptions,
          toolNameMapping
        });
        const namespace = openaiOptions?.namespace;
        if (namespace == null) {
          openaiTools.push(openaiFunctionTool);
        } else {
          let namespaceTool = namespaceTools.get(namespace.name);
          if (namespaceTool == null) {
            namespaceTool = {
              type: "namespace",
              name: namespace.name,
              description: namespace.description,
              tools: []
            };
            namespaceTools.set(namespace.name, namespaceTool);
            openaiTools.push(namespaceTool);
          } else if (namespaceTool.description !== namespace.description) {
            throw new UnsupportedFunctionalityError5({
              functionality: `conflicting descriptions for OpenAI tool namespace "${namespace.name}"`
            });
          }
          namespaceTool.tools.push(openaiFunctionTool);
        }
        break;
      }
      case "provider": {
        switch (tool.id) {
          case "openai.file_search": {
            const args = await validateTypes2({
              value: tool.args,
              schema: fileSearchArgsSchema
            });
            openaiTools.push({
              type: "file_search",
              vector_store_ids: args.vectorStoreIds,
              max_num_results: args.maxNumResults,
              ranking_options: args.ranking ? {
                ranker: args.ranking.ranker,
                score_threshold: args.ranking.scoreThreshold
              } : void 0,
              filters: args.filters
            });
            break;
          }
          case "openai.local_shell": {
            openaiTools.push({
              type: "local_shell"
            });
            break;
          }
          case "openai.shell": {
            const args = await validateTypes2({
              value: tool.args,
              schema: shellArgsSchema
            });
            openaiTools.push({
              type: "shell",
              ...args.environment && {
                environment: mapShellEnvironment(args.environment)
              }
            });
            break;
          }
          case "openai.apply_patch": {
            openaiTools.push({
              type: "apply_patch"
            });
            break;
          }
          case "openai.computer": {
            openaiTools.push({
              type: "computer"
            });
            break;
          }
          case "openai.web_search_preview": {
            const args = await validateTypes2({
              value: tool.args,
              schema: webSearchPreviewArgsSchema
            });
            openaiTools.push({
              type: "web_search_preview",
              search_context_size: args.searchContextSize,
              user_location: args.userLocation
            });
            break;
          }
          case "openai.web_search": {
            const args = await validateTypes2({
              value: tool.args,
              schema: webSearchArgsSchema
            });
            openaiTools.push({
              type: "web_search",
              filters: args.filters != null ? {
                allowed_domains: args.filters.allowedDomains,
                blocked_domains: args.filters.blockedDomains
              } : void 0,
              external_web_access: args.externalWebAccess,
              search_context_size: args.searchContextSize,
              user_location: args.userLocation
            });
            break;
          }
          case "openai.code_interpreter": {
            const args = await validateTypes2({
              value: tool.args,
              schema: codeInterpreterArgsSchema
            });
            openaiTools.push({
              type: "code_interpreter",
              container: args.container == null ? { type: "auto", file_ids: void 0 } : typeof args.container === "string" ? args.container : { type: "auto", file_ids: args.container.fileIds }
            });
            break;
          }
          case "openai.image_generation": {
            const args = await validateTypes2({
              value: tool.args,
              schema: imageGenerationArgsSchema
            });
            openaiTools.push({
              type: "image_generation",
              background: args.background,
              input_fidelity: args.inputFidelity,
              input_image_mask: args.inputImageMask ? {
                file_id: args.inputImageMask.fileId,
                image_url: args.inputImageMask.imageUrl
              } : void 0,
              model: args.model,
              moderation: args.moderation,
              partial_images: args.partialImages,
              quality: args.quality,
              output_compression: args.outputCompression,
              output_format: args.outputFormat,
              size: args.size
            });
            break;
          }
          case "openai.mcp": {
            const args = await validateTypes2({
              value: tool.args,
              schema: mcpArgsSchema
            });
            const mapApprovalFilter = (filter) => ({
              tool_names: filter.toolNames
            });
            const requireApproval = args.requireApproval;
            const requireApprovalParam = requireApproval == null ? void 0 : typeof requireApproval === "string" ? requireApproval : requireApproval.never != null ? { never: mapApprovalFilter(requireApproval.never) } : void 0;
            openaiTools.push({
              type: "mcp",
              server_label: args.serverLabel,
              allowed_tools: Array.isArray(args.allowedTools) ? args.allowedTools : args.allowedTools ? {
                read_only: args.allowedTools.readOnly,
                tool_names: args.allowedTools.toolNames
              } : void 0,
              authorization: args.authorization,
              connector_id: args.connectorId,
              headers: args.headers,
              require_approval: requireApprovalParam ?? "never",
              server_description: args.serverDescription,
              server_url: args.serverUrl
            });
            break;
          }
          case "openai.custom": {
            const args = await validateTypes2({
              value: tool.args,
              schema: customArgsSchema
            });
            openaiTools.push({
              type: "custom",
              name: tool.name,
              description: args.description,
              format: args.format
            });
            resolvedCustomProviderToolNames.add(tool.name);
            break;
          }
          case "openai.programmatic_tool_calling": {
            openaiTools.push({
              type: "programmatic_tool_calling"
            });
            break;
          }
          case "openai.tool_search": {
            const args = await validateTypes2({
              value: tool.args,
              schema: toolSearchArgsSchema
            });
            openaiTools.push({
              type: "tool_search",
              ...args.execution != null ? { execution: args.execution } : {},
              ...args.description != null ? { description: args.description } : {},
              ...args.parameters != null ? { parameters: args.parameters } : {}
            });
            break;
          }
        }
        break;
      }
      default:
        toolWarnings.push({
          type: "unsupported",
          feature: `function tool ${tool}`
        });
        break;
    }
  }
  if (allowedTools != null) {
    return {
      tools: openaiTools,
      toolChoice: {
        type: "allowed_tools",
        mode: allowedTools.mode ?? "auto",
        tools: allowedTools.toolNames.map((name) => ({
          type: "function",
          name: toolNameMapping?.toProviderToolName(name) ?? name
        }))
      },
      toolWarnings
    };
  }
  if (toolChoice == null) {
    return { tools: openaiTools, toolChoice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiTools, toolChoice: type, toolWarnings };
    case "tool": {
      const resolvedToolName = toolNameMapping?.toProviderToolName(toolChoice.toolName) ?? toolChoice.toolName;
      return {
        tools: openaiTools,
        toolChoice: resolvedToolName === "code_interpreter" || resolvedToolName === "file_search" || resolvedToolName === "image_generation" || resolvedToolName === "web_search_preview" || resolvedToolName === "web_search" || resolvedToolName === "mcp" || resolvedToolName === "apply_patch" || resolvedToolName === "computer" || resolvedToolName === "programmatic_tool_calling" ? { type: resolvedToolName } : resolvedCustomProviderToolNames.has(resolvedToolName) ? { type: "custom", name: resolvedToolName } : { type: "function", name: resolvedToolName },
        toolWarnings
      };
    }
    default: {
      const _exhaustiveCheck = type;
      throw new UnsupportedFunctionalityError5({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}
function prepareFunctionTool({
  tool,
  options,
  toolNameMapping
}) {
  const deferLoading = options?.deferLoading;
  return {
    type: "function",
    name: toolNameMapping?.toProviderToolName(tool.name) ?? tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    ...tool.strict != null ? { strict: tool.strict } : {},
    ...deferLoading != null ? { defer_loading: deferLoading } : {},
    ...options?.allowedCallers != null ? { allowed_callers: options.allowedCallers } : {},
    ...options?.outputSchema != null ? { output_schema: options.outputSchema } : {}
  };
}
function mapShellEnvironment(environment) {
  if (environment.type === "containerReference") {
    const env2 = environment;
    return {
      type: "container_reference",
      container_id: env2.containerId
    };
  }
  if (environment.type === "containerAuto") {
    const env2 = environment;
    return {
      type: "container_auto",
      file_ids: env2.fileIds,
      memory_limit: env2.memoryLimit,
      network_policy: env2.networkPolicy == null ? void 0 : env2.networkPolicy.type === "disabled" ? { type: "disabled" } : {
        type: "allowlist",
        allowed_domains: env2.networkPolicy.allowedDomains,
        domain_secrets: env2.networkPolicy.domainSecrets
      },
      skills: mapShellSkills(env2.skills)
    };
  }
  const env = environment;
  return {
    type: "local",
    skills: env.skills
  };
}
function mapShellSkills(skills) {
  return skills?.map(
    (skill) => skill.type === "skillReference" ? {
      type: "skill_reference",
      skill_id: resolveProviderReference3({
        reference: skill.providerReference ?? {},
        provider: "openai"
      }),
      version: skill.version ?? "latest"
    } : {
      type: "inline",
      name: skill.name,
      description: skill.description,
      source: {
        type: "base64",
        media_type: skill.source.mediaType,
        data: skill.source.data
      }
    }
  );
}

// src/responses/openai-responses-language-model.ts
var MAX_CODEX_TOOL_SEARCH_ROUNDS = 3;
var codexToolSearchRequestSequence = 0;
function logCodexToolSearchRequest({
  request,
  round,
  requestBody
}) {
  if (process.env.OPENAI_TOOL_SEARCH_COMPAT_DEBUG !== "1") {
    return;
  }
  const input = Array.isArray(requestBody.input) ? requestBody.input : [];
  const inputItems = input.map((item, index) => {
    if (item == null || typeof item !== "object") {
      return { index, type: typeof item };
    }
    const record = item;
    return {
      index,
      type: record.type ?? record.role ?? "unknown",
      ...typeof record.id === "string" ? { id: record.id } : {},
      ...typeof record.call_id === "string" ? { callId: record.call_id } : {},
      ...record.type === "reasoning" ? { hasEncryptedContent: typeof record.encrypted_content === "string" } : {}
    };
  });
  console.error(
    "OPENAI TOOL SEARCH COMPAT REQUEST",
    JSON.stringify({
      request,
      round,
      store: requestBody.store,
      previousResponseId: requestBody.previous_response_id,
      inputItems
    })
  );
}
function toolSearchOutput(call) {
  return {
    type: "tool_search_output",
    execution: call.execution,
    call_id: call.call_id ?? call.id,
    status: "completed",
    // OpenCode's tool descriptions are already present in the initial request.
    // Do not duplicate them as dynamically loaded tools.
    tools: []
  };
}
function prepareCodexToolSearchFollowUpInput(output) {
  return output.flatMap((part) => {
    if (part.type !== "reasoning") {
      return [part];
    }
    if (part.encrypted_content == null) {
      return [];
    }
    return [
      {
        type: "reasoning",
        encrypted_content: part.encrypted_content,
        summary: part.summary
      }
    ];
  });
}
function extractApprovalRequestIdToToolCallIdMapping(prompt) {
  const mapping = {};
  for (const message of prompt) {
    if (message.role !== "assistant") continue;
    for (const part of message.content) {
      if (part.type !== "tool-call") continue;
      const approvalRequestId = part.providerOptions?.openai?.approvalRequestId;
      if (approvalRequestId != null) {
        mapping[approvalRequestId] = part.toolCallId;
      }
    }
  }
  return mapping;
}
function mapComputerAction(action) {
  switch (action.type) {
    case "click":
      return {
        type: "click",
        button: action.button,
        x: action.x,
        y: action.y,
        ...action.keys != null && { keys: action.keys }
      };
    case "double_click":
      return {
        type: "double_click",
        x: action.x,
        y: action.y,
        ...action.keys != null && { keys: action.keys }
      };
    case "drag":
      return {
        type: "drag",
        path: action.path,
        ...action.keys != null && { keys: action.keys }
      };
    case "keypress":
      return action;
    case "move":
      return {
        type: "move",
        x: action.x,
        y: action.y,
        ...action.keys != null && { keys: action.keys }
      };
    case "screenshot":
      return action;
    case "scroll":
      return {
        type: "scroll",
        x: action.x,
        y: action.y,
        scrollX: action.scroll_x,
        scrollY: action.scroll_y,
        ...action.keys != null && { keys: action.keys }
      };
    case "type":
      return action;
    case "wait":
      return action;
  }
}
function mapComputerCallInput({
  action,
  actions,
  pending_safety_checks,
  status
}) {
  return {
    actions: (actions ?? (action != null ? [action] : [])).map(
      mapComputerAction
    ),
    pendingSafetyChecks: pending_safety_checks?.map((safetyCheck) => ({
      id: safetyCheck.id,
      ...safetyCheck.code != null && { code: safetyCheck.code },
      ...safetyCheck.message != null && { message: safetyCheck.message }
    })) ?? [],
    status
  };
}
var OpenAIResponsesLanguageModel = class _OpenAIResponsesLanguageModel {
  specificationVersion = "v4";
  modelId;
  config;
  static [WORKFLOW_SERIALIZE5](model) {
    return serializeModelOptions5({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE5](options) {
    return new _OpenAIResponsesLanguageModel(options.modelId, options.config);
  }
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  supportedUrls = {
    "image/*": [/^https?:\/\/.*$/],
    "application/pdf": [/^https?:\/\/.*$/]
  };
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    maxOutputTokens,
    temperature,
    stopSequences,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    seed,
    prompt,
    reasoning,
    providerOptions,
    tools,
    toolChoice,
    responseFormat
  }) {
    const warnings = [];
    const modelCapabilities = getOpenAILanguageModelCapabilities(this.modelId);
    if (topK != null) {
      warnings.push({ type: "unsupported", feature: "topK" });
    }
    if (seed != null) {
      warnings.push({ type: "unsupported", feature: "seed" });
    }
    if (presencePenalty != null) {
      warnings.push({ type: "unsupported", feature: "presencePenalty" });
    }
    if (frequencyPenalty != null) {
      warnings.push({ type: "unsupported", feature: "frequencyPenalty" });
    }
    if (stopSequences != null) {
      warnings.push({ type: "unsupported", feature: "stopSequences" });
    }
    const providerOptionsName = this.config.provider.includes("azure") ? "azure" : "openai";
    let openaiOptions = await parseProviderOptions6({
      provider: providerOptionsName,
      providerOptions,
      schema: openaiLanguageModelResponsesOptionsSchema
    });
    if (openaiOptions == null && providerOptionsName !== "openai") {
      openaiOptions = await parseProviderOptions6({
        provider: "openai",
        providerOptions,
        schema: openaiLanguageModelResponsesOptionsSchema
      });
    }
    const resolvedReasoningEffort = openaiOptions?.reasoningEffort ?? (isCustomReasoning2(reasoning) ? reasoning : void 0);
    const resolvedReasoningSummary = openaiOptions?.reasoningSummary !== void 0 ? openaiOptions.reasoningSummary : resolvedReasoningEffort != null && resolvedReasoningEffort !== "none" ? "detailed" : void 0;
    const isReasoningModel = openaiOptions?.forceReasoning ?? modelCapabilities.isReasoningModel;
    if (openaiOptions?.conversation && openaiOptions?.previousResponseId) {
      warnings.push({
        type: "unsupported",
        feature: "conversation",
        details: "conversation and previousResponseId cannot be used together"
      });
    }
    const requestTools = tools ?? [];
    const toolNameMapping = createToolNameMapping({
      tools: requestTools,
      providerToolNames: {
        "openai.code_interpreter": "code_interpreter",
        "openai.computer": "computer",
        "openai.file_search": "file_search",
        "openai.image_generation": "image_generation",
        "openai.local_shell": "local_shell",
        "openai.shell": "shell",
        "openai.web_search": "web_search",
        "openai.web_search_preview": "web_search_preview",
        "openai.mcp": "mcp",
        "openai.apply_patch": "apply_patch",
        "openai.tool_search": "tool_search",
        "openai.programmatic_tool_calling": "programmatic_tool_calling"
      }
    });
    const customProviderToolNames = /* @__PURE__ */ new Set();
    const outputSchemaToolNames = /* @__PURE__ */ new Set();
    const {
      tools: openaiTools,
      toolChoice: openaiToolChoice,
      toolWarnings
    } = await prepareResponsesTools({
      tools: requestTools,
      toolChoice,
      allowedTools: openaiOptions?.allowedTools ?? void 0,
      toolNameMapping,
      customProviderToolNames,
      outputSchemaToolNames
    });
    const store = openaiOptions?.store ?? true;
    const { input, warnings: inputWarnings } = await convertToOpenAIResponsesInput({
      prompt,
      toolNameMapping,
      systemMessageMode: openaiOptions?.systemMessageMode ?? (isReasoningModel ? "developer" : modelCapabilities.systemMessageMode),
      providerOptionsName,
      fileIdPrefixes: this.config.fileIdPrefixes,
      passThroughUnsupportedFiles: openaiOptions?.passThroughUnsupportedFiles ?? false,
      store,
      hasConversation: openaiOptions?.conversation != null,
      hasPreviousResponseId: openaiOptions?.previousResponseId != null,
      // The compatibility endpoint does not reliably persist response items
      // across OpenCode turns, even when the request uses store: true.
      avoidAssistantMessageItemReferences: true,
      avoidReasoningItemReferences: true,
      avoidToolSearchItemReferences: true,
      hasLocalShellTool: hasOpenAITool("openai.local_shell"),
      hasShellTool: hasOpenAITool("openai.shell"),
      hasApplyPatchTool: hasOpenAITool("openai.apply_patch"),
      hasComputerTool: hasOpenAITool("openai.computer"),
      customProviderToolNames: customProviderToolNames.size > 0 ? customProviderToolNames : void 0,
      outputSchemaToolNames: outputSchemaToolNames.size > 0 ? outputSchemaToolNames : void 0
    });
    warnings.push(...inputWarnings);
    const strictJsonSchema = openaiOptions?.strictJsonSchema ?? true;
    let include = openaiOptions?.include;
    function addInclude(key) {
      if (include == null) {
        include = [key];
      } else if (!include.includes(key)) {
        include = [...include, key];
      }
    }
    function hasOpenAITool(id) {
      return requestTools.find((tool) => tool.type === "provider" && tool.id === id) != null;
    }
    const topLogprobs = typeof openaiOptions?.logprobs === "number" ? openaiOptions?.logprobs : openaiOptions?.logprobs === true ? TOP_LOGPROBS_MAX : void 0;
    if (topLogprobs) {
      addInclude("message.output_text.logprobs");
    }
    const webSearchToolName = requestTools.find(
      (tool) => tool.type === "provider" && (tool.id === "openai.web_search" || tool.id === "openai.web_search_preview")
    )?.name;
    if (webSearchToolName) {
      addInclude("web_search_call.action.sources");
    }
    if (hasOpenAITool("openai.code_interpreter")) {
      addInclude("code_interpreter_call.outputs");
    }
    if (isReasoningModel) {
      addInclude("reasoning.encrypted_content");
    }
    const baseArgs = {
      model: this.modelId,
      input,
      temperature,
      top_p: topP,
      max_output_tokens: maxOutputTokens,
      ...(responseFormat?.type === "json" || openaiOptions?.textVerbosity) && {
        text: {
          ...responseFormat?.type === "json" && {
            format: responseFormat.schema != null ? {
              type: "json_schema",
              strict: strictJsonSchema,
              name: responseFormat.name ?? "response",
              description: responseFormat.description,
              schema: responseFormat.schema
            } : { type: "json_object" }
          },
          ...openaiOptions?.textVerbosity && {
            verbosity: openaiOptions.textVerbosity
          }
        }
      },
      // provider options:
      conversation: openaiOptions?.conversation,
      max_tool_calls: openaiOptions?.maxToolCalls,
      metadata: openaiOptions?.metadata,
      parallel_tool_calls: openaiOptions?.parallelToolCalls,
      previous_response_id: openaiOptions?.previousResponseId,
      store,
      user: openaiOptions?.user,
      instructions: openaiOptions?.instructions,
      service_tier: openaiOptions?.serviceTier,
      include,
      prompt_cache_key: openaiOptions?.promptCacheKey,
      prompt_cache_options: openaiOptions?.promptCacheOptions,
      prompt_cache_retention: openaiOptions?.promptCacheRetention,
      safety_identifier: openaiOptions?.safetyIdentifier,
      top_logprobs: topLogprobs,
      truncation: openaiOptions?.truncation,
      // context management (server-side compaction):
      ...openaiOptions?.contextManagement && {
        context_management: openaiOptions.contextManagement.map((cm) => ({
          type: cm.type,
          compact_threshold: cm.compactThreshold
        }))
      },
      // model-specific settings:
      ...isReasoningModel && (resolvedReasoningEffort != null || resolvedReasoningSummary != null || openaiOptions?.reasoningMode != null || openaiOptions?.reasoningContext != null) && {
        reasoning: {
          ...resolvedReasoningEffort != null && {
            effort: resolvedReasoningEffort
          },
          ...resolvedReasoningSummary != null && {
            summary: resolvedReasoningSummary
          },
          ...openaiOptions?.reasoningMode != null && {
            mode: openaiOptions.reasoningMode
          },
          ...openaiOptions?.reasoningContext != null && {
            context: openaiOptions.reasoningContext
          }
        }
      }
    };
    if (isReasoningModel) {
      if (!(resolvedReasoningEffort === "none" && modelCapabilities.supportsNonReasoningParameters)) {
        if (baseArgs.temperature != null) {
          baseArgs.temperature = void 0;
          warnings.push({
            type: "unsupported",
            feature: "temperature",
            details: "temperature is not supported for reasoning models"
          });
        }
        if (baseArgs.top_p != null) {
          baseArgs.top_p = void 0;
          warnings.push({
            type: "unsupported",
            feature: "topP",
            details: "topP is not supported for reasoning models"
          });
        }
      }
    } else {
      if (openaiOptions?.reasoningEffort != null) {
        warnings.push({
          type: "unsupported",
          feature: "reasoningEffort",
          details: "reasoningEffort is not supported for non-reasoning models"
        });
      }
      if (openaiOptions?.reasoningSummary != null) {
        warnings.push({
          type: "unsupported",
          feature: "reasoningSummary",
          details: "reasoningSummary is not supported for non-reasoning models"
        });
      }
      if (openaiOptions?.reasoningMode != null) {
        warnings.push({
          type: "unsupported",
          feature: "reasoningMode",
          details: "reasoningMode is not supported for non-reasoning models"
        });
      }
      if (openaiOptions?.reasoningContext != null) {
        warnings.push({
          type: "unsupported",
          feature: "reasoningContext",
          details: "reasoningContext is not supported for non-reasoning models"
        });
      }
    }
    if (openaiOptions?.serviceTier === "flex" && !modelCapabilities.supportsFlexProcessing) {
      warnings.push({
        type: "unsupported",
        feature: "serviceTier",
        details: "flex processing is only available for o3, o4-mini, and gpt-5 models"
      });
      delete baseArgs.service_tier;
    }
    if ((openaiOptions?.serviceTier === "priority" || openaiOptions?.serviceTier === "fast") && !modelCapabilities.supportsPriorityProcessing) {
      warnings.push({
        type: "unsupported",
        feature: "serviceTier",
        details: "priority processing is only available for supported models (gpt-4, gpt-5, gpt-5-mini, o3, o4-mini) and requires Enterprise access. gpt-5-nano is not supported"
      });
      delete baseArgs.service_tier;
    }
    const shellToolEnvType = requestTools.find(
      (tool) => tool.type === "provider" && tool.id === "openai.shell"
    )?.args?.environment?.type;
    const isShellProviderExecuted = shellToolEnvType === "containerAuto" || shellToolEnvType === "containerReference";
    return {
      webSearchToolName,
      args: {
        ...baseArgs,
        tools: openaiTools,
        tool_choice: openaiToolChoice
      },
      warnings: [...warnings, ...toolWarnings],
      store,
      toolNameMapping,
      providerOptionsName,
      isShellProviderExecuted
    };
  }
  async doGenerate(options) {
    const {
      args: body,
      warnings,
      webSearchToolName,
      toolNameMapping,
      providerOptionsName,
      isShellProviderExecuted
    } = await this.getArgs(options);
    let requestBody = body;
    const url = this.config.url({
      path: "/responses",
      modelId: this.modelId
    });
    const approvalRequestIdToDummyToolCallIdFromPrompt = extractApprovalRequestIdToToolCallIdMapping(options.prompt);
    let responseHeaders;
    let response;
    let rawResponse;
    const request = ++codexToolSearchRequestSequence;
    for (let round = 0; round < MAX_CODEX_TOOL_SEARCH_ROUNDS; round++) {
      logCodexToolSearchRequest({
        request,
        round,
        requestBody
      });
      const result = await postJsonToApi5({
        url,
        headers: combineHeaders5(this.config.headers?.(), options.headers),
        body: requestBody,
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler5(
          openaiResponsesResponseSchema
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch
      });
      responseHeaders = result.responseHeaders;
      response = result.value;
      rawResponse = result.rawValue;
      if (response.error) {
        throw new APICallError2({
          message: response.error.message,
          url,
          requestBodyValues: requestBody,
          statusCode: 400,
          responseHeaders,
          responseBody: rawResponse,
          isRetryable: false
        });
      }
      if (response.output == null) {
        const detail = response.incomplete_details?.reason;
        throw new APICallError2({
          message: detail ? `Responses API returned no output (${detail})` : "Responses API returned no output",
          url,
          requestBodyValues: requestBody,
          statusCode: 500,
          responseHeaders,
          responseBody: rawResponse,
          isRetryable: false
        });
      }
      const toolSearchOutputCallIds = new Set(
        response.output.flatMap(
          (part) => part.type === "tool_search_output" && part.call_id != null ? [part.call_id] : []
        )
      );
      const pendingToolSearchCalls = response.output.filter(
        (part) => part.type === "tool_search_call" && !toolSearchOutputCallIds.has(part.call_id ?? part.id)
      );
      if (pendingToolSearchCalls.length === 0) {
        break;
      }
      if (round === MAX_CODEX_TOOL_SEARCH_ROUNDS - 1) {
        throw new APICallError2({
          message: "Responses API returned too many client-side tool_search_call items",
          url,
          requestBodyValues: requestBody,
          statusCode: 500,
          responseHeaders,
          responseBody: rawResponse,
          isRetryable: false
        });
      }
      requestBody = {
        ...requestBody,
        input: [
          ...Array.isArray(requestBody.input) ? requestBody.input : [],
          ...prepareCodexToolSearchFollowUpInput(response.output),
          ...pendingToolSearchCalls.map(
            (call) => toolSearchOutput(call)
          )
        ]
      };
    }
    if (response.output == null) {
      throw new APICallError2({
        message: "Responses API returned no output",
        url,
        requestBodyValues: requestBody,
        statusCode: 500,
        responseHeaders,
        responseBody: rawResponse,
        isRetryable: false
      });
    }
    const output = response.output;
    const content = [];
    const logprobs = [];
    let hasFunctionCall = false;
    const hostedToolSearchCallIds = [];
    for (const part of output) {
      switch (part.type) {
        case "reasoning": {
          if (part.summary.length === 0) {
            part.summary.push({ type: "summary_text", text: "" });
          }
          for (const summary of part.summary) {
            content.push({
              type: "reasoning",
              text: summary.text,
              providerMetadata: {
                [providerOptionsName]: {
                  itemId: part.id,
                  reasoningEncryptedContent: part.encrypted_content ?? null
                }
              }
            });
          }
          break;
        }
        case "image_generation_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName("image_generation"),
            input: "{}",
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName("image_generation"),
            result: {
              result: part.result
            }
          });
          break;
        }
        case "tool_search_call": {
          if (part.execution === "client") {
            break;
          }
          const toolCallId = part.call_id ?? part.id;
          const isHosted = part.execution === "server";
          if (isHosted) {
            hostedToolSearchCallIds.push(toolCallId);
          }
          content.push({
            type: "tool-call",
            toolCallId,
            toolName: toolNameMapping.toCustomToolName("tool_search"),
            input: JSON.stringify({
              arguments: part.arguments,
              call_id: part.call_id
            }),
            ...isHosted ? { providerExecuted: true } : {},
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "tool_search_output": {
          if (part.execution === "client") {
            break;
          }
          const toolCallId = part.call_id ?? hostedToolSearchCallIds.shift() ?? part.id;
          content.push({
            type: "tool-result",
            toolCallId,
            toolName: toolNameMapping.toCustomToolName("tool_search"),
            result: {
              tools: part.tools
            },
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "local_shell_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: toolNameMapping.toCustomToolName("local_shell"),
            input: JSON.stringify({
              action: part.action
            }),
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "shell_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: toolNameMapping.toCustomToolName("shell"),
            input: JSON.stringify({
              action: {
                commands: part.action.commands
              }
            }),
            ...isShellProviderExecuted && { providerExecuted: true },
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "shell_call_output": {
          content.push({
            type: "tool-result",
            toolCallId: part.call_id,
            toolName: toolNameMapping.toCustomToolName("shell"),
            result: {
              output: part.output.map((item) => ({
                stdout: item.stdout,
                stderr: item.stderr,
                outcome: item.outcome.type === "exit" ? {
                  type: "exit",
                  exitCode: item.outcome.exit_code
                } : { type: "timeout" }
              }))
            }
          });
          break;
        }
        case "message": {
          for (const contentPart of part.content) {
            if (options.providerOptions?.[providerOptionsName]?.logprobs && contentPart.logprobs) {
              logprobs.push(contentPart.logprobs);
            }
            const providerMetadata2 = {
              itemId: part.id,
              ...part.phase != null && { phase: part.phase },
              ...contentPart.annotations.length > 0 && {
                annotations: contentPart.annotations
              }
            };
            content.push({
              type: "text",
              text: contentPart.text,
              providerMetadata: {
                [providerOptionsName]: providerMetadata2
              }
            });
            for (const annotation of contentPart.annotations) {
              if (annotation.type === "url_citation") {
                content.push({
                  type: "source",
                  sourceType: "url",
                  id: this.config.generateId?.() ?? generateId2(),
                  url: annotation.url,
                  title: annotation.title
                });
              } else if (annotation.type === "file_citation") {
                content.push({
                  type: "source",
                  sourceType: "document",
                  id: this.config.generateId?.() ?? generateId2(),
                  mediaType: "text/plain",
                  title: annotation.filename,
                  filename: annotation.filename,
                  providerMetadata: {
                    [providerOptionsName]: {
                      type: annotation.type,
                      fileId: annotation.file_id,
                      index: annotation.index
                    }
                  }
                });
              } else if (annotation.type === "container_file_citation") {
                content.push({
                  type: "source",
                  sourceType: "document",
                  id: this.config.generateId?.() ?? generateId2(),
                  mediaType: "text/plain",
                  title: annotation.filename,
                  filename: annotation.filename,
                  providerMetadata: {
                    [providerOptionsName]: {
                      type: annotation.type,
                      fileId: annotation.file_id,
                      containerId: annotation.container_id
                    }
                  }
                });
              } else if (annotation.type === "file_path") {
                content.push({
                  type: "source",
                  sourceType: "document",
                  id: this.config.generateId?.() ?? generateId2(),
                  mediaType: "application/octet-stream",
                  title: annotation.file_id,
                  filename: annotation.file_id,
                  providerMetadata: {
                    [providerOptionsName]: {
                      type: annotation.type,
                      fileId: annotation.file_id,
                      index: annotation.index
                    }
                  }
                });
              }
            }
          }
          break;
        }
        case "function_call": {
          hasFunctionCall = true;
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: toolNameMapping.toCustomToolName(part.name),
            input: part.arguments,
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id,
                ...part.namespace != null && { namespace: part.namespace },
                ...part.caller != null && {
                  caller: part.caller.type === "program" ? {
                    type: "program",
                    callerId: part.caller.caller_id
                  } : part.caller
                }
              }
            }
          });
          break;
        }
        case "program": {
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: toolNameMapping.toCustomToolName(
              "programmatic_tool_calling"
            ),
            input: JSON.stringify({
              code: part.code,
              fingerprint: part.fingerprint
            }),
            providerExecuted: true,
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "program_output": {
          content.push({
            type: "tool-result",
            toolCallId: part.call_id,
            toolName: toolNameMapping.toCustomToolName(
              "programmatic_tool_calling"
            ),
            result: {
              result: part.result,
              status: part.status
            },
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "custom_tool_call": {
          hasFunctionCall = true;
          const toolName = toolNameMapping.toCustomToolName(part.name);
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName,
            input: JSON.stringify(part.input),
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "web_search_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName(
              webSearchToolName ?? "web_search"
            ),
            input: JSON.stringify({}),
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName(
              webSearchToolName ?? "web_search"
            ),
            result: mapWebSearchOutput(part.action)
          });
          break;
        }
        case "mcp_call": {
          const toolCallId = part.approval_request_id != null ? approvalRequestIdToDummyToolCallIdFromPrompt[part.approval_request_id] ?? part.id : part.id;
          const toolName = `mcp.${part.name}`;
          content.push({
            type: "tool-call",
            toolCallId,
            toolName,
            input: part.arguments,
            providerExecuted: true,
            dynamic: true
          });
          content.push({
            type: "tool-result",
            toolCallId,
            toolName,
            result: {
              type: "call",
              serverLabel: part.server_label,
              name: part.name,
              arguments: part.arguments,
              ...part.output != null ? { output: part.output } : {},
              ...part.error != null ? { error: part.error } : {}
            },
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "mcp_list_tools": {
          break;
        }
        case "mcp_approval_request": {
          const approvalRequestId = part.approval_request_id ?? part.id;
          const dummyToolCallId = this.config.generateId?.() ?? generateId2();
          const toolName = `mcp.${part.name}`;
          content.push({
            type: "tool-call",
            toolCallId: dummyToolCallId,
            toolName,
            input: part.arguments,
            providerExecuted: true,
            dynamic: true
          });
          content.push({
            type: "tool-approval-request",
            approvalId: approvalRequestId,
            toolCallId: dummyToolCallId
          });
          break;
        }
        case "computer_call": {
          if (part.call_id == null) {
            content.push({
              type: "tool-call",
              toolCallId: part.id,
              toolName: toolNameMapping.toCustomToolName("computer_use"),
              input: "",
              providerExecuted: true
            });
            content.push({
              type: "tool-result",
              toolCallId: part.id,
              toolName: toolNameMapping.toCustomToolName("computer_use"),
              result: {
                type: "computer_use_tool_result",
                status: part.status
              }
            });
            break;
          }
          hasFunctionCall = true;
          const toolName = toolNameMapping.toCustomToolName("computer");
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName,
            input: JSON.stringify(mapComputerCallInput(part)),
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "file_search_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName("file_search"),
            input: "{}",
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName("file_search"),
            result: {
              queries: part.queries,
              results: part.results?.map((result) => ({
                attributes: result.attributes,
                fileId: result.file_id,
                filename: result.filename,
                score: result.score,
                text: result.text
              })) ?? null
            }
          });
          break;
        }
        case "code_interpreter_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName("code_interpreter"),
            input: JSON.stringify({
              code: part.code,
              containerId: part.container_id
            }),
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: toolNameMapping.toCustomToolName("code_interpreter"),
            result: {
              outputs: part.outputs
            }
          });
          break;
        }
        case "apply_patch_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: toolNameMapping.toCustomToolName("apply_patch"),
            input: JSON.stringify({
              callId: part.call_id,
              operation: part.operation
            }),
            providerMetadata: {
              [providerOptionsName]: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "compaction": {
          content.push({
            type: "custom",
            kind: "openai.compaction",
            providerMetadata: {
              [providerOptionsName]: {
                type: "compaction",
                itemId: part.id,
                encryptedContent: part.encrypted_content
              }
            }
          });
          break;
        }
      }
    }
    const providerMetadata = {
      [providerOptionsName]: {
        responseId: response.id,
        ...logprobs.length > 0 ? { logprobs } : {},
        ...typeof response.service_tier === "string" ? { serviceTier: response.service_tier } : {},
        ...response.reasoning?.context != null ? { reasoningContext: response.reasoning.context } : {}
      }
    };
    const usage = response.usage;
    return {
      content,
      finishReason: {
        unified: mapOpenAIResponseFinishReason({
          finishReason: response.incomplete_details?.reason,
          hasFunctionCall
        }),
        raw: response.incomplete_details?.reason ?? void 0
      },
      usage: convertOpenAIResponsesUsage(usage),
      request: { body: requestBody },
      response: {
        id: response.id,
        timestamp: new Date(response.created_at * 1e3),
        modelId: response.model,
        headers: responseHeaders,
        body: rawResponse
      },
      providerMetadata,
      warnings
    };
  }
  async doStream(options) {
    const generated = await this.doGenerate(options);
    return {
      stream: createBufferedLanguageModelStream(generated),
      request: generated.request,
      response: generated.response
    };
    const {
      args: body,
      warnings,
      webSearchToolName,
      toolNameMapping,
      store,
      providerOptionsName,
      isShellProviderExecuted
    } = await this.getArgs(options);
    const url = this.config.url({
      path: "/responses",
      modelId: this.modelId
    });
    const { responseHeaders, value: response } = await postJsonToApi5({
      url,
      headers: combineHeaders5(this.config.headers?.(), options.headers),
      body: {
        ...body,
        stream: true
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler3(
        openaiResponsesChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const checkedResponse = await throwIfOpenAIStreamErrorBeforeOutput({
      stream: response,
      getError: (chunk) => isErrorChunk(chunk) || isResponseFailedChunk(chunk) && chunk.response.error != null ? chunk : void 0,
      isOutputChunk: isResponseOutputChunk,
      isAcceptedChunk: isResponseInProgressChunk,
      url,
      requestBodyValues: body,
      responseHeaders
    });
    const self = this;
    const approvalRequestIdToDummyToolCallIdFromPrompt = extractApprovalRequestIdToToolCallIdMapping(options.prompt);
    const approvalRequestIdToDummyToolCallIdFromStream = /* @__PURE__ */ new Map();
    let finishReason = {
      unified: "other",
      raw: void 0
    };
    let usage = void 0;
    const logprobs = [];
    let responseId = null;
    const ongoingToolCalls = {};
    const ongoingAnnotations = [];
    let activeMessagePhase;
    let hasFunctionCall = false;
    const activeReasoning = {};
    const activeOutputItemIds = {};
    const resolveOutputItemId = ({
      itemId,
      outputIndex
    }) => outputIndex == null ? itemId : activeOutputItemIds[outputIndex] ?? itemId;
    let serviceTier;
    let reasoningContext;
    const hostedToolSearchCallIds = [];
    let encounteredStreamError = false;
    const result = {
      stream: checkedResponse.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
            if (!chunk.success) {
              const error = isOpenAIChatCompletionChunk(chunk.rawValue) ? createOpenAIResponsesChatCompletionsMismatchError({
                value: chunk.rawValue,
                cause: chunk.error,
                url,
                requestBodyValues: body,
                responseHeaders
              }) : chunk.error;
              finishReason = { unified: "error", raw: void 0 };
              controller.enqueue({ type: "error", error });
              return;
            }
            const value = chunk.value;
            if (isResponseOutputItemAddedChunk(value)) {
              if (value.item.type === "function_call") {
                const toolName = toolNameMapping.toCustomToolName(
                  value.item.name
                );
                ongoingToolCalls[value.output_index] = {
                  toolName,
                  toolCallId: value.item.call_id
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.call_id,
                  toolName
                });
              } else if (value.item.type === "custom_tool_call") {
                const toolName = toolNameMapping.toCustomToolName(
                  value.item.name
                );
                ongoingToolCalls[value.output_index] = {
                  toolName,
                  toolCallId: value.item.call_id
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.call_id,
                  toolName
                });
              } else if (value.item.type === "web_search_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: toolNameMapping.toCustomToolName(
                    webSearchToolName ?? "web_search"
                  ),
                  toolCallId: value.item.id
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: toolNameMapping.toCustomToolName(
                    webSearchToolName ?? "web_search"
                  ),
                  providerExecuted: true
                });
                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.id
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: toolNameMapping.toCustomToolName(
                    webSearchToolName ?? "web_search"
                  ),
                  input: JSON.stringify({}),
                  providerExecuted: true
                });
              } else if (value.item.type === "computer_call") {
                const toolCallId = value.item.call_id ?? value.item.id;
                ongoingToolCalls[value.output_index] = {
                  toolName: toolNameMapping.toCustomToolName("computer"),
                  toolCallId
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: toolCallId,
                  toolName: toolNameMapping.toCustomToolName("computer")
                });
              } else if (value.item.type === "code_interpreter_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: toolNameMapping.toCustomToolName("code_interpreter"),
                  toolCallId: value.item.id,
                  codeInterpreter: {
                    containerId: value.item.container_id
                  }
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: toolNameMapping.toCustomToolName("code_interpreter"),
                  providerExecuted: true
                });
                controller.enqueue({
                  type: "tool-input-delta",
                  id: value.item.id,
                  delta: `{"containerId":"${value.item.container_id}","code":"`
                });
              } else if (value.item.type === "file_search_call") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: toolNameMapping.toCustomToolName("file_search"),
                  input: "{}",
                  providerExecuted: true
                });
              } else if (value.item.type === "image_generation_call") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: toolNameMapping.toCustomToolName("image_generation"),
                  input: "{}",
                  providerExecuted: true
                });
              } else if (value.item.type === "tool_search_call") {
                const toolCallId = value.item.id;
                const toolName = toolNameMapping.toCustomToolName("tool_search");
                const isHosted = value.item.execution === "server";
                ongoingToolCalls[value.output_index] = {
                  toolName,
                  toolCallId,
                  toolSearchExecution: value.item.execution ?? "server"
                };
                if (isHosted) {
                  controller.enqueue({
                    type: "tool-input-start",
                    id: toolCallId,
                    toolName,
                    providerExecuted: true
                  });
                }
              } else if (value.item.type === "tool_search_output") {
              } else if (value.item.type === "mcp_call" || value.item.type === "mcp_list_tools" || value.item.type === "mcp_approval_request") {
              } else if (value.item.type === "apply_patch_call") {
                const { call_id: callId, operation } = value.item;
                ongoingToolCalls[value.output_index] = {
                  toolName: toolNameMapping.toCustomToolName("apply_patch"),
                  toolCallId: callId,
                  applyPatch: {
                    // delete_file doesn't have diff
                    hasDiff: operation.type === "delete_file",
                    endEmitted: operation.type === "delete_file"
                  }
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: callId,
                  toolName: toolNameMapping.toCustomToolName("apply_patch")
                });
                if (operation.type === "delete_file") {
                  const inputString = JSON.stringify({
                    callId,
                    operation
                  });
                  controller.enqueue({
                    type: "tool-input-delta",
                    id: callId,
                    delta: inputString
                  });
                  controller.enqueue({
                    type: "tool-input-end",
                    id: callId
                  });
                } else {
                  controller.enqueue({
                    type: "tool-input-delta",
                    id: callId,
                    delta: `{"callId":"${escapeJSONDelta(callId)}","operation":{"type":"${escapeJSONDelta(operation.type)}","path":"${escapeJSONDelta(operation.path)}","diff":"`
                  });
                }
              } else if (value.item.type === "shell_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: toolNameMapping.toCustomToolName("shell"),
                  toolCallId: value.item.call_id
                };
              } else if (value.item.type === "shell_call_output") {
              } else if (value.item.type === "message") {
                activeOutputItemIds[value.output_index] = value.item.id;
                ongoingAnnotations.splice(0, ongoingAnnotations.length);
                activeMessagePhase = value.item.phase ?? void 0;
                controller.enqueue({
                  type: "text-start",
                  id: value.item.id,
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id,
                      ...value.item.phase != null && {
                        phase: value.item.phase
                      }
                    }
                  }
                });
              } else if (isResponseOutputItemAddedChunk(value) && value.item.type === "reasoning") {
                activeOutputItemIds[value.output_index] = value.item.id;
                activeReasoning[value.item.id] = {
                  encryptedContent: value.item.encrypted_content,
                  summaryParts: { 0: "active" }
                };
                controller.enqueue({
                  type: "reasoning-start",
                  id: `${value.item.id}:0`,
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id,
                      reasoningEncryptedContent: value.item.encrypted_content ?? null
                    }
                  }
                });
              }
            } else if (isResponseOutputItemDoneChunk(value)) {
              if (value.item.type === "message") {
                const itemId = resolveOutputItemId({
                  itemId: value.item.id,
                  outputIndex: value.output_index
                });
                const phase = value.item.phase ?? activeMessagePhase;
                activeMessagePhase = void 0;
                controller.enqueue({
                  type: "text-end",
                  id: itemId,
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId,
                      ...phase != null && { phase },
                      ...ongoingAnnotations.length > 0 && {
                        annotations: ongoingAnnotations
                      }
                    }
                  }
                });
                activeOutputItemIds[value.output_index] = void 0;
              } else if (value.item.type === "function_call") {
                ongoingToolCalls[value.output_index] = void 0;
                hasFunctionCall = true;
                const toolName = toolNameMapping.toCustomToolName(
                  value.item.name
                );
                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.call_id,
                  ...value.item.namespace != null && {
                    providerMetadata: {
                      [providerOptionsName]: {
                        namespace: value.item.namespace
                      }
                    }
                  }
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName,
                  input: value.item.arguments,
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id,
                      ...value.item.namespace != null && {
                        namespace: value.item.namespace
                      },
                      ...value.item.caller != null && {
                        caller: value.item.caller.type === "program" ? {
                          type: "program",
                          callerId: value.item.caller.caller_id
                        } : value.item.caller
                      }
                    }
                  }
                });
              } else if (value.item.type === "program") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName: toolNameMapping.toCustomToolName(
                    "programmatic_tool_calling"
                  ),
                  input: JSON.stringify({
                    code: value.item.code,
                    fingerprint: value.item.fingerprint
                  }),
                  providerExecuted: true,
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (value.item.type === "program_output") {
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.call_id,
                  toolName: toolNameMapping.toCustomToolName(
                    "programmatic_tool_calling"
                  ),
                  result: {
                    result: value.item.result,
                    status: value.item.status
                  },
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (value.item.type === "custom_tool_call") {
                ongoingToolCalls[value.output_index] = void 0;
                hasFunctionCall = true;
                const toolName = toolNameMapping.toCustomToolName(
                  value.item.name
                );
                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.call_id
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName,
                  input: JSON.stringify(value.item.input),
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (value.item.type === "web_search_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: toolNameMapping.toCustomToolName(
                    webSearchToolName ?? "web_search"
                  ),
                  result: mapWebSearchOutput(value.item.action)
                });
              } else if (value.item.type === "computer_call") {
                ongoingToolCalls[value.output_index] = void 0;
                if (value.item.call_id == null) {
                  controller.enqueue({
                    type: "tool-input-end",
                    id: value.item.id
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: value.item.id,
                    toolName: toolNameMapping.toCustomToolName("computer_use"),
                    input: "",
                    providerExecuted: true
                  });
                  controller.enqueue({
                    type: "tool-result",
                    toolCallId: value.item.id,
                    toolName: toolNameMapping.toCustomToolName("computer_use"),
                    result: {
                      type: "computer_use_tool_result",
                      status: value.item.status
                    }
                  });
                  return;
                }
                hasFunctionCall = true;
                const toolName = toolNameMapping.toCustomToolName("computer");
                const input = JSON.stringify(mapComputerCallInput(value.item));
                controller.enqueue({
                  type: "tool-input-delta",
                  id: value.item.call_id,
                  delta: input
                });
                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.call_id
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName,
                  input,
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (value.item.type === "file_search_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: toolNameMapping.toCustomToolName("file_search"),
                  result: {
                    queries: value.item.queries,
                    results: value.item.results?.map((result2) => ({
                      attributes: result2.attributes,
                      fileId: result2.file_id,
                      filename: result2.filename,
                      score: result2.score,
                      text: result2.text
                    })) ?? null
                  }
                });
              } else if (value.item.type === "code_interpreter_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: toolNameMapping.toCustomToolName("code_interpreter"),
                  result: {
                    outputs: value.item.outputs
                  }
                });
              } else if (value.item.type === "image_generation_call") {
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: toolNameMapping.toCustomToolName("image_generation"),
                  result: {
                    result: value.item.result
                  }
                });
              } else if (value.item.type === "tool_search_call") {
                const toolCall = ongoingToolCalls[value.output_index];
                const isHosted = value.item.execution === "server";
                if (!isHosted) {
                  ongoingToolCalls[value.output_index] = void 0;
                  return;
                }
                if (toolCall != null) {
                  const toolCallId = isHosted ? toolCall.toolCallId : value.item.call_id ?? value.item.id;
                  if (isHosted) {
                    hostedToolSearchCallIds.push(toolCallId);
                  } else {
                    controller.enqueue({
                      type: "tool-input-start",
                      id: toolCallId,
                      toolName: toolCall.toolName
                    });
                  }
                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCallId
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId,
                    toolName: toolCall.toolName,
                    input: JSON.stringify({
                      arguments: value.item.arguments,
                      call_id: isHosted ? null : toolCallId
                    }),
                    ...isHosted ? { providerExecuted: true } : {},
                    providerMetadata: {
                      [providerOptionsName]: {
                        itemId: value.item.id
                      }
                    }
                  });
                }
                ongoingToolCalls[value.output_index] = void 0;
              } else if (value.item.type === "tool_search_output") {
                if (value.item.execution === "client") {
                  return;
                }
                const toolCallId = value.item.call_id ?? hostedToolSearchCallIds.shift() ?? value.item.id;
                controller.enqueue({
                  type: "tool-result",
                  toolCallId,
                  toolName: toolNameMapping.toCustomToolName("tool_search"),
                  result: {
                    tools: value.item.tools
                  },
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (value.item.type === "mcp_call") {
                ongoingToolCalls[value.output_index] = void 0;
                const approvalRequestId = value.item.approval_request_id ?? void 0;
                const aliasedToolCallId = approvalRequestId != null ? approvalRequestIdToDummyToolCallIdFromStream.get(
                  approvalRequestId
                ) ?? approvalRequestIdToDummyToolCallIdFromPrompt[approvalRequestId] ?? value.item.id : value.item.id;
                const toolName = `mcp.${value.item.name}`;
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: aliasedToolCallId,
                  toolName,
                  input: value.item.arguments,
                  providerExecuted: true,
                  dynamic: true
                });
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: aliasedToolCallId,
                  toolName,
                  result: {
                    type: "call",
                    serverLabel: value.item.server_label,
                    name: value.item.name,
                    arguments: value.item.arguments,
                    ...value.item.output != null ? { output: value.item.output } : {},
                    ...value.item.error != null ? { error: value.item.error } : {}
                  },
                  providerMetadata: {
                    [providerOptionsName]: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (value.item.type === "mcp_list_tools") {
                ongoingToolCalls[value.output_index] = void 0;
              } else if (value.item.type === "apply_patch_call") {
                const toolCall = ongoingToolCalls[value.output_index];
                if (toolCall?.applyPatch && !toolCall.applyPatch.endEmitted && value.item.operation.type !== "delete_file") {
                  if (!toolCall.applyPatch.hasDiff) {
                    controller.enqueue({
                      type: "tool-input-delta",
                      id: toolCall.toolCallId,
                      delta: escapeJSONDelta(value.item.operation.diff)
                    });
                  }
                  controller.enqueue({
                    type: "tool-input-delta",
                    id: toolCall.toolCallId,
                    delta: '"}}'
                  });
                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCall.toolCallId
                  });
                  toolCall.applyPatch.endEmitted = true;
                }
                if (toolCall && value.item.status === "completed") {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: toolCall.toolCallId,
                    toolName: toolNameMapping.toCustomToolName("apply_patch"),
                    input: JSON.stringify({
                      callId: value.item.call_id,
                      operation: value.item.operation
                    }),
                    providerMetadata: {
                      [providerOptionsName]: {
                        itemId: value.item.id
                      }
                    }
                  });
                }
                ongoingToolCalls[value.output_index] = void 0;
              } else if (value.item.type === "mcp_approval_request") {
                ongoingToolCalls[value.output_index] = void 0;
                const dummyToolCallId = self.config.generateId?.() ?? generateId2();
                const approvalRequestId = value.item.approval_request_id ?? value.item.id;
                approvalRequestIdToDummyToolCallIdFromStream.set(
                  approvalRequestId,
                  dummyToolCallId
                );
                const toolName = `mcp.${value.item.name}`;
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: dummyToolCallId,
                  toolName,
                  input: value.item.arguments,
                  providerExecuted: true,
                  dynamic: true
                });
                controller.enqueue({
                  type: "tool-approval-request",
                  approvalId: approvalRequestId,
                  toolCallId: dummyToolCallId
                });
              } else if (value.item.type === "local_shell_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName: toolNameMapping.toCustomToolName("local_shell"),
                  input: JSON.stringify({
                    action: {
                      type: "exec",
                      command: value.item.action.command,
                      timeoutMs: value.item.action.timeout_ms,
                      user: value.item.action.user,
                      workingDirectory: value.item.action.working_directory,
                      env: value.item.action.env
                    }
                  }),
                  providerMetadata: {
                    [providerOptionsName]: { itemId: value.item.id }
                  }
                });
              } else if (value.item.type === "shell_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName: toolNameMapping.toCustomToolName("shell"),
                  input: JSON.stringify({
                    action: {
                      commands: value.item.action.commands
                    }
                  }),
                  ...isShellProviderExecuted && {
                    providerExecuted: true
                  },
                  providerMetadata: {
                    [providerOptionsName]: { itemId: value.item.id }
                  }
                });
              } else if (value.item.type === "shell_call_output") {
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.call_id,
                  toolName: toolNameMapping.toCustomToolName("shell"),
                  result: {
                    output: value.item.output.map(
                      (item) => ({
                        stdout: item.stdout,
                        stderr: item.stderr,
                        outcome: item.outcome.type === "exit" ? {
                          type: "exit",
                          exitCode: item.outcome.exit_code
                        } : { type: "timeout" }
                      })
                    )
                  }
                });
              } else if (value.item.type === "reasoning") {
                const itemId = resolveOutputItemId({
                  itemId: value.item.id,
                  outputIndex: value.output_index
                });
                const activeReasoningPart = activeReasoning[itemId];
                if (activeReasoningPart != null) {
                  const summaryPartIndices = Object.entries(
                    activeReasoningPart.summaryParts
                  ).filter(
                    ([_, status]) => status === "active" || status === "can-conclude"
                  ).map(([summaryIndex]) => summaryIndex);
                  for (const summaryIndex of summaryPartIndices) {
                    controller.enqueue({
                      type: "reasoning-end",
                      id: `${itemId}:${summaryIndex}`,
                      providerMetadata: {
                        [providerOptionsName]: {
                          itemId,
                          reasoningEncryptedContent: value.item.encrypted_content ?? null
                        }
                      }
                    });
                  }
                  delete activeReasoning[itemId];
                }
                activeOutputItemIds[value.output_index] = void 0;
              } else if (value.item.type === "compaction") {
                controller.enqueue({
                  type: "custom",
                  kind: "openai.compaction",
                  providerMetadata: {
                    [providerOptionsName]: {
                      type: "compaction",
                      itemId: value.item.id,
                      encryptedContent: value.item.encrypted_content
                    }
                  }
                });
              }
            } else if (isResponseFunctionCallArgumentsDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: value.delta
                });
              }
            } else if (isResponseCustomToolCallInputDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: value.delta
                });
              }
            } else if (isResponseApplyPatchCallOperationDiffDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall?.applyPatch) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: escapeJSONDelta(value.delta)
                });
                toolCall.applyPatch.hasDiff = true;
              }
            } else if (isResponseApplyPatchCallOperationDiffDoneChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall?.applyPatch && !toolCall.applyPatch.endEmitted) {
                if (!toolCall.applyPatch.hasDiff) {
                  controller.enqueue({
                    type: "tool-input-delta",
                    id: toolCall.toolCallId,
                    delta: escapeJSONDelta(value.diff)
                  });
                  toolCall.applyPatch.hasDiff = true;
                }
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: '"}}'
                });
                controller.enqueue({
                  type: "tool-input-end",
                  id: toolCall.toolCallId
                });
                toolCall.applyPatch.endEmitted = true;
              }
            } else if (isResponseImageGenerationCallPartialImageChunk(value)) {
              controller.enqueue({
                type: "tool-result",
                toolCallId: value.item_id,
                toolName: toolNameMapping.toCustomToolName("image_generation"),
                result: {
                  result: value.partial_image_b64
                },
                preliminary: true
              });
            } else if (isResponseCodeInterpreterCallCodeDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: escapeJSONDelta(value.delta)
                });
              }
            } else if (isResponseCodeInterpreterCallCodeDoneChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: '"}'
                });
                controller.enqueue({
                  type: "tool-input-end",
                  id: toolCall.toolCallId
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: toolCall.toolCallId,
                  toolName: toolNameMapping.toCustomToolName("code_interpreter"),
                  input: JSON.stringify({
                    code: value.code,
                    containerId: toolCall.codeInterpreter.containerId
                  }),
                  providerExecuted: true
                });
              }
            } else if (isResponseCreatedChunk(value)) {
              responseId = value.response.id;
              controller.enqueue({
                type: "response-metadata",
                id: value.response.id,
                timestamp: new Date(value.response.created_at * 1e3),
                modelId: value.response.model
              });
            } else if (isTextDeltaChunk(value)) {
              const itemId = resolveOutputItemId({
                itemId: value.item_id,
                outputIndex: value.output_index
              });
              controller.enqueue({
                type: "text-delta",
                id: itemId,
                delta: value.delta
              });
              if (options.providerOptions?.[providerOptionsName]?.logprobs && value.logprobs) {
                logprobs.push(value.logprobs);
              }
            } else if (value.type === "response.reasoning_summary_part.added") {
              const itemId = resolveOutputItemId({
                itemId: value.item_id,
                outputIndex: value.output_index
              });
              if (value.summary_index > 0) {
                const activeReasoningPart = activeReasoning[itemId];
                if (activeReasoningPart != null) {
                  activeReasoningPart.summaryParts[value.summary_index] = "active";
                  for (const summaryIndex of Object.keys(
                    activeReasoningPart.summaryParts
                  )) {
                    if (activeReasoningPart.summaryParts[summaryIndex] === "can-conclude") {
                      controller.enqueue({
                        type: "reasoning-end",
                        id: `${itemId}:${summaryIndex}`,
                        providerMetadata: {
                          [providerOptionsName]: {
                            itemId
                          }
                        }
                      });
                      activeReasoningPart.summaryParts[summaryIndex] = "concluded";
                    }
                  }
                  controller.enqueue({
                    type: "reasoning-start",
                    id: `${itemId}:${value.summary_index}`,
                    providerMetadata: {
                      [providerOptionsName]: {
                        itemId,
                        reasoningEncryptedContent: activeReasoningPart.encryptedContent ?? null
                      }
                    }
                  });
                }
              }
            } else if (value.type === "response.reasoning_summary_text.delta") {
              const itemId = resolveOutputItemId({
                itemId: value.item_id,
                outputIndex: value.output_index
              });
              controller.enqueue({
                type: "reasoning-delta",
                id: `${itemId}:${value.summary_index}`,
                delta: value.delta,
                providerMetadata: {
                  [providerOptionsName]: {
                    itemId
                  }
                }
              });
            } else if (value.type === "response.reasoning_summary_part.done") {
              const itemId = resolveOutputItemId({
                itemId: value.item_id,
                outputIndex: value.output_index
              });
              const activeReasoningPart = activeReasoning[itemId];
              if (activeReasoningPart != null) {
                if (store) {
                  controller.enqueue({
                    type: "reasoning-end",
                    id: `${itemId}:${value.summary_index}`,
                    providerMetadata: {
                      [providerOptionsName]: {
                        itemId
                      }
                    }
                  });
                  activeReasoningPart.summaryParts[value.summary_index] = "concluded";
                } else {
                  activeReasoningPart.summaryParts[value.summary_index] = "can-conclude";
                }
              }
            } else if (isResponseFinishedChunk(value)) {
              finishReason = {
                unified: mapOpenAIResponseFinishReason({
                  finishReason: value.response.incomplete_details?.reason,
                  hasFunctionCall
                }),
                raw: value.response.incomplete_details?.reason ?? void 0
              };
              usage = value.response.usage;
              if (typeof value.response.service_tier === "string") {
                serviceTier = value.response.service_tier;
              }
              if (value.response.reasoning?.context != null) {
                reasoningContext = value.response.reasoning.context;
              }
            } else if (isResponseFailedChunk(value)) {
              const incompleteReason = value.response.incomplete_details?.reason;
              finishReason = {
                unified: incompleteReason ? mapOpenAIResponseFinishReason({
                  finishReason: incompleteReason,
                  hasFunctionCall
                }) : "error",
                raw: incompleteReason ?? "error"
              };
              usage = value.response.usage ?? void 0;
              if (value.response.reasoning?.context != null) {
                reasoningContext = value.response.reasoning.context;
              }
              if (!encounteredStreamError && value.response.error != null) {
                encounteredStreamError = true;
                controller.enqueue({
                  type: "error",
                  error: {
                    type: "response.failed",
                    sequence_number: value.sequence_number,
                    response: {
                      error: value.response.error,
                      incomplete_details: value.response.incomplete_details,
                      service_tier: value.response.service_tier
                    }
                  }
                });
              }
            } else if (isResponseAnnotationAddedChunk(value)) {
              ongoingAnnotations.push(value.annotation);
              if (value.annotation.type === "url_citation") {
                controller.enqueue({
                  type: "source",
                  sourceType: "url",
                  id: self.config.generateId?.() ?? generateId2(),
                  url: value.annotation.url,
                  title: value.annotation.title
                });
              } else if (value.annotation.type === "file_citation") {
                controller.enqueue({
                  type: "source",
                  sourceType: "document",
                  id: self.config.generateId?.() ?? generateId2(),
                  mediaType: "text/plain",
                  title: value.annotation.filename,
                  filename: value.annotation.filename,
                  providerMetadata: {
                    [providerOptionsName]: {
                      type: value.annotation.type,
                      fileId: value.annotation.file_id,
                      index: value.annotation.index
                    }
                  }
                });
              } else if (value.annotation.type === "container_file_citation") {
                controller.enqueue({
                  type: "source",
                  sourceType: "document",
                  id: self.config.generateId?.() ?? generateId2(),
                  mediaType: "text/plain",
                  title: value.annotation.filename,
                  filename: value.annotation.filename,
                  providerMetadata: {
                    [providerOptionsName]: {
                      type: value.annotation.type,
                      fileId: value.annotation.file_id,
                      containerId: value.annotation.container_id
                    }
                  }
                });
              } else if (value.annotation.type === "file_path") {
                controller.enqueue({
                  type: "source",
                  sourceType: "document",
                  id: self.config.generateId?.() ?? generateId2(),
                  mediaType: "application/octet-stream",
                  title: value.annotation.file_id,
                  filename: value.annotation.file_id,
                  providerMetadata: {
                    [providerOptionsName]: {
                      type: value.annotation.type,
                      fileId: value.annotation.file_id,
                      index: value.annotation.index
                    }
                  }
                });
              }
            } else if (isErrorChunk(value)) {
              encounteredStreamError = true;
              finishReason = { unified: "error", raw: "error" };
              controller.enqueue({ type: "error", error: value });
            }
          },
          flush(controller) {
            const providerMetadata = {
              [providerOptionsName]: {
                responseId,
                ...logprobs.length > 0 ? { logprobs } : {},
                ...serviceTier !== void 0 ? { serviceTier } : {},
                ...reasoningContext !== void 0 ? { reasoningContext } : {}
              }
            };
            controller.enqueue({
              type: "finish",
              finishReason,
              usage: convertOpenAIResponsesUsage(usage),
              providerMetadata
            });
          }
        })
      ),
      request: { body },
      response: { headers: responseHeaders }
    };
    return result;
  }
};
function createBufferedLanguageModelStream(result) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: "stream-start",
        warnings: result.warnings
      });
      if (result.response != null) {
        controller.enqueue({
          type: "response-metadata",
          id: result.response.id,
          timestamp: result.response.timestamp,
          modelId: result.response.modelId
        });
      }
      for (const content of result.content) {
        switch (content.type) {
          case "text": {
            const id = generateId2();
            controller.enqueue({
              type: "text-start",
              id,
              providerMetadata: content.providerMetadata
            });
            controller.enqueue({
              type: "text-delta",
              id,
              delta: content.text,
              providerMetadata: content.providerMetadata
            });
            controller.enqueue({
              type: "text-end",
              id,
              providerMetadata: content.providerMetadata
            });
            break;
          }
          case "reasoning": {
            const id = generateId2();
            controller.enqueue({
              type: "reasoning-start",
              id,
              providerMetadata: content.providerMetadata
            });
            controller.enqueue({
              type: "reasoning-delta",
              id,
              delta: content.text,
              providerMetadata: content.providerMetadata
            });
            controller.enqueue({
              type: "reasoning-end",
              id,
              providerMetadata: content.providerMetadata
            });
            break;
          }
          case "tool-call": {
            controller.enqueue({
              type: "tool-input-start",
              id: content.toolCallId,
              toolName: content.toolName,
              providerExecuted: content.providerExecuted,
              dynamic: content.dynamic,
              providerMetadata: content.providerMetadata
            });
            controller.enqueue({
              type: "tool-input-end",
              id: content.toolCallId,
              providerMetadata: content.providerMetadata
            });
            controller.enqueue(content);
            break;
          }
          default:
            controller.enqueue(content);
        }
      }
      controller.enqueue({
        type: "finish",
        finishReason: result.finishReason,
        usage: result.usage,
        providerMetadata: result.providerMetadata
      });
      controller.close();
    }
  });
}
function isTextDeltaChunk(chunk) {
  return chunk.type === "response.output_text.delta";
}
function isOpenAIChatCompletionChunk(value) {
  const chunk = asRecord2(value);
  return chunk != null && Array.isArray(chunk.choices) && typeof chunk.type !== "string";
}
function createOpenAIResponsesChatCompletionsMismatchError({
  value,
  cause,
  url,
  requestBodyValues,
  responseHeaders
}) {
  return new APICallError2({
    message: "Received a Chat Completions stream while using the OpenAI Responses API. The default OpenAI provider model uses the Responses API. If your custom baseURL targets a Chat Completions-compatible endpoint, use openai.chat('model-id') or createOpenAI(...).chat('model-id') instead. You can also use @ai-sdk/openai-compatible for OpenAI-compatible providers.",
    url,
    requestBodyValues,
    responseHeaders,
    responseBody: JSON.stringify(value),
    cause,
    data: value,
    isRetryable: false
  });
}
function asRecord2(value) {
  return typeof value === "object" && value != null ? value : void 0;
}
function isResponseOutputItemDoneChunk(chunk) {
  return chunk.type === "response.output_item.done";
}
function isResponseFinishedChunk(chunk) {
  return chunk.type === "response.completed" || chunk.type === "response.incomplete";
}
function isResponseFailedChunk(chunk) {
  return chunk.type === "response.failed";
}
function isResponseCreatedChunk(chunk) {
  return chunk.type === "response.created";
}
function isResponseFunctionCallArgumentsDeltaChunk(chunk) {
  return chunk.type === "response.function_call_arguments.delta";
}
function isResponseCustomToolCallInputDeltaChunk(chunk) {
  return chunk.type === "response.custom_tool_call_input.delta";
}
function isResponseImageGenerationCallPartialImageChunk(chunk) {
  return chunk.type === "response.image_generation_call.partial_image";
}
function isResponseCodeInterpreterCallCodeDeltaChunk(chunk) {
  return chunk.type === "response.code_interpreter_call_code.delta";
}
function isResponseCodeInterpreterCallCodeDoneChunk(chunk) {
  return chunk.type === "response.code_interpreter_call_code.done";
}
function isResponseApplyPatchCallOperationDiffDeltaChunk(chunk) {
  return chunk.type === "response.apply_patch_call_operation_diff.delta";
}
function isResponseApplyPatchCallOperationDiffDoneChunk(chunk) {
  return chunk.type === "response.apply_patch_call_operation_diff.done";
}
function isResponseOutputItemAddedChunk(chunk) {
  return chunk.type === "response.output_item.added";
}
function isResponseAnnotationAddedChunk(chunk) {
  return chunk.type === "response.output_text.annotation.added";
}
function isErrorChunk(chunk) {
  return chunk.type === "error";
}
function isResponseInProgressChunk(chunk) {
  return chunk.type === "response.in_progress";
}
function isResponseOutputChunk(chunk) {
  return !(chunk.type === "response.created" || chunk.type === "response.in_progress" || chunk.type === "response.failed" || chunk.type === "error" || chunk.type === "unknown_chunk");
}
function mapWebSearchOutput(action) {
  if (action == null) {
    return {};
  }
  switch (action.type) {
    case "search":
      return {
        action: {
          type: "search",
          query: action.query ?? void 0,
          ...action.queries != null && { queries: action.queries }
        },
        // include sources when provided by the Responses API (behind include flag)
        ...action.sources != null && { sources: action.sources }
      };
    case "open_page":
      return { action: { type: "openPage", url: action.url } };
    case "find_in_page":
      return {
        action: {
          type: "findInPage",
          url: action.url,
          pattern: action.pattern
        }
      };
  }
}
function escapeJSONDelta(delta) {
  return JSON.stringify(delta).slice(1, -1);
}

// src/speech/openai-speech-model-options.ts
import {
  lazySchema as lazySchema24,
  zodSchema as zodSchema24
} from "@ai-sdk/provider-utils";
import { z as z26 } from "zod/v4";
var openaiSpeechModelOptionsSchema = lazySchema24(
  () => zodSchema24(
    z26.object({
      instructions: z26.string().nullish(),
      speed: z26.number().min(0.25).max(4).default(1).nullish()
    })
  )
);

// src/speech/openai-speech-model.ts
import {
  combineHeaders as combineHeaders6,
  createBinaryResponseHandler,
  parseProviderOptions as parseProviderOptions7,
  postJsonToApi as postJsonToApi6,
  serializeModelOptions as serializeModelOptions6,
  WORKFLOW_DESERIALIZE as WORKFLOW_DESERIALIZE6,
  WORKFLOW_SERIALIZE as WORKFLOW_SERIALIZE6
} from "@ai-sdk/provider-utils";
var OpenAISpeechModel = class _OpenAISpeechModel {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  modelId;
  config;
  specificationVersion = "v4";
  static [WORKFLOW_SERIALIZE6](model) {
    return serializeModelOptions6({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE6](options) {
    return new _OpenAISpeechModel(options.modelId, options.config);
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    text,
    voice = "alloy",
    outputFormat = "mp3",
    speed,
    instructions,
    language,
    providerOptions
  }) {
    const warnings = [];
    const openAIOptions = await parseProviderOptions7({
      provider: "openai",
      providerOptions,
      schema: openaiSpeechModelOptionsSchema
    });
    const requestBody = {
      model: this.modelId,
      input: text,
      voice,
      response_format: "mp3",
      speed,
      instructions
    };
    if (outputFormat) {
      if (["mp3", "opus", "aac", "flac", "wav", "pcm"].includes(outputFormat)) {
        requestBody.response_format = outputFormat;
      } else {
        warnings.push({
          type: "unsupported",
          feature: "outputFormat",
          details: `Unsupported output format: ${outputFormat}. Using mp3 instead.`
        });
      }
    }
    if (openAIOptions) {
      const speechModelOptions = {};
      for (const key in speechModelOptions) {
        const value = speechModelOptions[key];
        if (value !== void 0) {
          requestBody[key] = value;
        }
      }
    }
    if (language) {
      warnings.push({
        type: "unsupported",
        feature: "language",
        details: `OpenAI speech models do not support language selection. Language parameter "${language}" was ignored.`
      });
    }
    return {
      requestBody,
      warnings
    };
  }
  async doGenerate(options) {
    const currentDate = this.config._internal?.currentDate?.() ?? /* @__PURE__ */ new Date();
    const { requestBody, warnings } = await this.getArgs(options);
    const {
      value: audio,
      responseHeaders,
      rawValue: rawResponse
    } = await postJsonToApi6({
      url: this.config.url({
        path: "/audio/speech",
        modelId: this.modelId
      }),
      headers: combineHeaders6(this.config.headers?.(), options.headers),
      body: requestBody,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createBinaryResponseHandler(),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    return {
      audio,
      warnings,
      request: {
        body: JSON.stringify(requestBody)
      },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse
      }
    };
  }
};

// src/transcription/openai-transcription-model-options.ts
import {
  lazySchema as lazySchema25,
  zodSchema as zodSchema25
} from "@ai-sdk/provider-utils";
import { z as z27 } from "zod/v4";
var openAITranscriptionModelOptions = lazySchema25(
  () => zodSchema25(
    z27.object({
      /**
       * Additional information to include in the transcription response.
       */
      include: z27.array(z27.string()).optional(),
      /**
       * The language of the input audio in ISO-639-1 format.
       */
      language: z27.string().optional(),
      /**
       * An optional text to guide the model's style or continue a previous audio segment.
       */
      prompt: z27.string().optional(),
      /**
       * The sampling temperature, between 0 and 1.
       * @default 0
       */
      temperature: z27.number().min(0).max(1).default(0).optional(),
      /**
       * The timestamp granularities to populate for this transcription.
       * @default ['segment']
       */
      timestampGranularities: z27.array(z27.enum(["word", "segment"])).default(["segment"]).optional(),
      /**
       * Options for streaming transcription models such as `gpt-realtime-whisper`.
       */
      streaming: z27.object({
        /**
         * Latency/accuracy tradeoff for realtime transcription.
         */
        delay: z27.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
        /**
         * Additional fields to include in realtime transcription events.
         */
        include: z27.array(z27.string()).optional()
      }).optional()
    })
  )
);

// src/transcription/openai-transcription-model.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError6
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders7,
  convertBase64ToUint8Array as convertBase64ToUint8Array2,
  convertToBase64 as convertToBase643,
  createJsonResponseHandler as createJsonResponseHandler6,
  connectToWebSocket,
  mediaTypeToExtension,
  parseProviderOptions as parseProviderOptions8,
  postFormDataToApi as postFormDataToApi2,
  safeParseJSON,
  serializeModelOptions as serializeModelOptions7,
  toWebSocketUrl,
  WORKFLOW_DESERIALIZE as WORKFLOW_DESERIALIZE7,
  WORKFLOW_SERIALIZE as WORKFLOW_SERIALIZE7,
  waitForWebSocketBufferDrain
} from "@ai-sdk/provider-utils";

// src/transcription/openai-transcription-api.ts
import { lazySchema as lazySchema26, zodSchema as zodSchema26 } from "@ai-sdk/provider-utils";
import { z as z28 } from "zod/v4";
var openaiTranscriptionResponseSchema = lazySchema26(
  () => zodSchema26(
    z28.object({
      text: z28.string(),
      language: z28.string().nullish(),
      duration: z28.number().nullish(),
      words: z28.array(
        z28.object({
          word: z28.string(),
          start: z28.number(),
          end: z28.number()
        })
      ).nullish(),
      segments: z28.array(
        z28.object({
          id: z28.number(),
          seek: z28.number(),
          start: z28.number(),
          end: z28.number(),
          text: z28.string(),
          tokens: z28.array(z28.number()),
          temperature: z28.number(),
          avg_logprob: z28.number(),
          compression_ratio: z28.number(),
          no_speech_prob: z28.number()
        })
      ).nullish()
    })
  )
);

// src/transcription/openai-transcription-model.ts
function isRealtimeTranscriptionModelId(modelId) {
  return modelId === "gpt-realtime-whisper" || modelId.startsWith("gpt-realtime-whisper-");
}
var languageMap = {
  afrikaans: "af",
  arabic: "ar",
  armenian: "hy",
  azerbaijani: "az",
  belarusian: "be",
  bosnian: "bs",
  bulgarian: "bg",
  catalan: "ca",
  chinese: "zh",
  croatian: "hr",
  czech: "cs",
  danish: "da",
  dutch: "nl",
  english: "en",
  estonian: "et",
  finnish: "fi",
  french: "fr",
  galician: "gl",
  german: "de",
  greek: "el",
  hebrew: "he",
  hindi: "hi",
  hungarian: "hu",
  icelandic: "is",
  indonesian: "id",
  italian: "it",
  japanese: "ja",
  kannada: "kn",
  kazakh: "kk",
  korean: "ko",
  latvian: "lv",
  lithuanian: "lt",
  macedonian: "mk",
  malay: "ms",
  marathi: "mr",
  maori: "mi",
  nepali: "ne",
  norwegian: "no",
  persian: "fa",
  polish: "pl",
  portuguese: "pt",
  romanian: "ro",
  russian: "ru",
  serbian: "sr",
  slovak: "sk",
  slovenian: "sl",
  spanish: "es",
  swahili: "sw",
  swedish: "sv",
  tagalog: "tl",
  tamil: "ta",
  thai: "th",
  turkish: "tr",
  ukrainian: "uk",
  urdu: "ur",
  vietnamese: "vi",
  welsh: "cy"
};
var OpenAITranscriptionModel = class _OpenAITranscriptionModel {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  modelId;
  config;
  specificationVersion = "v4";
  static [WORKFLOW_SERIALIZE7](model) {
    return serializeModelOptions7({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE7](options) {
    return new _OpenAITranscriptionModel(options.modelId, options.config);
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    audio,
    mediaType,
    providerOptions
  }) {
    const warnings = [];
    const openAIOptions = await parseProviderOptions8({
      provider: "openai",
      providerOptions,
      schema: openAITranscriptionModelOptions
    });
    const formData = new FormData();
    const blob = audio instanceof Uint8Array ? new Blob([audio]) : new Blob([convertBase64ToUint8Array2(audio)]);
    formData.append("model", this.modelId);
    const fileExtension = mediaTypeToExtension(mediaType);
    formData.append(
      "file",
      new File([blob], "audio", { type: mediaType }),
      `audio.${fileExtension}`
    );
    if (this.modelId === "whisper-1") {
      formData.append("response_format", "verbose_json");
    }
    if (openAIOptions) {
      const isGpt4oTranscribeModel = [
        "gpt-4o-transcribe",
        "gpt-4o-mini-transcribe"
      ].includes(this.modelId);
      const transcriptionModelOptions = {
        include: openAIOptions.include,
        language: openAIOptions.language,
        prompt: openAIOptions.prompt,
        // https://platform.openai.com/docs/api-reference/audio/createTranscription#audio_createtranscription-response_format
        // prefer verbose_json to get segments for models that support it
        ...this.modelId !== "whisper-1" && {
          response_format: isGpt4oTranscribeModel ? "json" : "verbose_json"
        },
        temperature: openAIOptions.temperature,
        timestamp_granularities: openAIOptions.timestampGranularities
      };
      for (const [key, value] of Object.entries(transcriptionModelOptions)) {
        if (value != null) {
          if (Array.isArray(value)) {
            for (const item of value) {
              formData.append(`${key}[]`, String(item));
            }
          } else {
            formData.append(key, String(value));
          }
        }
      }
    }
    return {
      formData,
      warnings
    };
  }
  async doGenerate(options) {
    if (isRealtimeTranscriptionModelId(this.modelId)) {
      throw new UnsupportedFunctionalityError6({
        functionality: `non-streaming transcription with ${this.modelId}`
      });
    }
    const currentDate = this.config._internal?.currentDate?.() ?? /* @__PURE__ */ new Date();
    const { formData, warnings } = await this.getArgs(options);
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse
    } = await postFormDataToApi2({
      url: this.config.url({
        path: "/audio/transcriptions",
        modelId: this.modelId
      }),
      headers: combineHeaders7(this.config.headers?.(), options.headers),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler6(
        openaiTranscriptionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const language = response.language != null && response.language in languageMap ? languageMap[response.language] : void 0;
    return {
      text: response.text,
      segments: response.segments?.map((segment) => ({
        text: segment.text,
        startSecond: segment.start,
        endSecond: segment.end
      })) ?? response.words?.map((word) => ({
        text: word.word,
        startSecond: word.start,
        endSecond: word.end
      })) ?? [],
      language,
      durationInSeconds: response.duration ?? void 0,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse
      }
    };
  }
  async doStream(options) {
    if (!isRealtimeTranscriptionModelId(this.modelId)) {
      throw new UnsupportedFunctionalityError6({
        functionality: `streaming transcription with ${this.modelId}`
      });
    }
    const currentDate = this.config._internal?.currentDate?.() ?? /* @__PURE__ */ new Date();
    const openAIOptions = await parseProviderOptions8({
      provider: "openai",
      providerOptions: options.providerOptions,
      schema: openAITranscriptionModelOptions
    });
    const warnings = [];
    const rawOpenAIOptions = options.providerOptions?.openai ?? {};
    for (const option of [
      "include",
      "prompt",
      "temperature",
      "timestampGranularities"
    ]) {
      if (rawOpenAIOptions[option] != null) {
        warnings.push({
          type: "unsupported",
          feature: `providerOptions.openai.${option}`,
          details: `OpenAI streaming transcription does not support ${option}.`
        });
      }
    }
    const headers = combineHeaders7(this.config.headers?.(), options.headers);
    const sessionUpdate = buildOpenAIRealtimeTranscriptionSession({
      modelId: this.modelId,
      inputAudioFormat: options.inputAudioFormat,
      providerOptions: openAIOptions
    });
    return {
      request: { body: sessionUpdate },
      response: {
        timestamp: currentDate,
        modelId: this.modelId
      },
      stream: createOpenAIRealtimeTranscriptionStream({
        webSocket: this.config.webSocket,
        url: toWebSocketUrl(
          this.config.url({
            path: "/realtime?intent=transcription",
            modelId: this.modelId
          })
        ),
        headers,
        sessionUpdate,
        language: openAIOptions?.language,
        warnings,
        audio: options.audio,
        abortSignal: options.abortSignal,
        includeRawChunks: options.includeRawChunks
      })
    };
  }
};
function createOpenAIRealtimeTranscriptionStream({
  webSocket,
  url,
  headers,
  sessionUpdate,
  language,
  warnings,
  audio,
  abortSignal,
  includeRawChunks
}) {
  let finished = false;
  let cleanup = () => {
  };
  return new ReadableStream({
    start: (controller) => {
      const realtimeConnection = getOpenAIRealtimeConnection(headers);
      let audioReader;
      let connection;
      cleanup = (closeCode) => {
        if (audioReader != null) {
          void audioReader.cancel().catch(() => {
          });
        } else {
          void audio.cancel().catch(() => {
          });
        }
        connection?.close(closeCode);
      };
      const finishWithError = (error) => {
        if (finished) return;
        finished = true;
        cleanup();
        controller.error(error);
      };
      const finish = (text, id) => {
        if (finished) return;
        finished = true;
        if (id != null) {
          controller.enqueue({ type: "transcript-final", id, text });
        }
        controller.enqueue({
          type: "finish",
          text,
          segments: [],
          language
        });
        controller.close();
        cleanup(1e3);
      };
      const sendAudio = async (socket) => {
        audioReader = audio.getReader();
        try {
          while (true) {
            const { done, value } = await audioReader.read();
            if (done || finished) break;
            socket.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: convertToBase643(value)
              })
            );
            await waitForWebSocketBufferDrain(socket);
          }
        } finally {
          audioReader.releaseLock();
          audioReader = void 0;
        }
        if (!finished) {
          socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        }
      };
      connection = connectToWebSocket({
        url,
        protocols: realtimeConnection.protocols,
        headers: realtimeConnection.headers,
        webSocket,
        abortSignal,
        onAbort: finishWithError,
        onProcessingError: finishWithError,
        onOpen: (socket) => {
          controller.enqueue({ type: "stream-start", warnings });
          socket.send(JSON.stringify(sessionUpdate));
          void sendAudio(socket).catch(finishWithError);
        },
        onMessageText: async (text) => {
          const parsed = await safeParseJSON({ text });
          if (!parsed.success) return;
          const raw = parsed.value;
          if (includeRawChunks) {
            controller.enqueue({ type: "raw", rawValue: raw });
          }
          switch (raw.type) {
            case "conversation.item.input_audio_transcription.delta": {
              controller.enqueue({
                type: "transcript-delta",
                id: raw.item_id,
                delta: raw.delta ?? ""
              });
              break;
            }
            case "conversation.item.input_audio_transcription.completed": {
              finish(raw.transcript ?? "", raw.item_id);
              break;
            }
            case "error": {
              finishWithError(
                new Error(raw.error?.message ?? "OpenAI realtime error")
              );
              break;
            }
          }
        },
        onSocketError: () => {
          finishWithError(new Error("OpenAI realtime transcription error"));
        },
        onClose: () => {
          if (finished) return;
          finished = true;
          cleanup();
          controller.close();
        }
      });
    },
    cancel: () => {
      if (finished) return;
      finished = true;
      cleanup();
    }
  });
}
function buildOpenAIRealtimeTranscriptionSession({
  modelId,
  inputAudioFormat,
  providerOptions
}) {
  return {
    type: "session.update",
    session: {
      type: "transcription",
      audio: {
        input: {
          format: {
            type: inputAudioFormat.type,
            ...inputAudioFormat.rate != null ? { rate: inputAudioFormat.rate } : {}
          },
          transcription: {
            model: modelId,
            ...providerOptions?.language != null ? { language: providerOptions.language } : {},
            ...providerOptions?.streaming?.delay != null ? { delay: providerOptions.streaming.delay } : {}
          },
          turn_detection: null
        }
      },
      ...providerOptions?.streaming?.include != null ? { include: providerOptions.streaming.include } : {}
    }
  };
}
function getOpenAIRealtimeConnection(headers) {
  let authorization;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization" && value != null) {
      authorization = value;
    }
  }
  const token = authorization?.match(/^bearer\s+(.+)$/i)?.[1];
  if (token == null) {
    return { protocols: ["realtime"], headers };
  }
  return {
    protocols: ["realtime", `openai-insecure-api-key.${token}`],
    headers: Object.fromEntries(
      Object.entries(headers).filter(
        ([key]) => key.toLowerCase() !== "authorization"
      )
    )
  };
}

export {
  openaiErrorDataSchema,
  openaiFailedResponseHandler,
  openaiLanguageModelChatOptions,
  OpenAIChatLanguageModel,
  openaiLanguageModelCompletionOptions,
  OpenAICompletionLanguageModel,
  openaiEmbeddingModelOptions,
  OpenAIEmbeddingModel,
  modelMaxImagesPerCall,
  hasDefaultResponseFormat,
  getMaxImagesPerCall,
  openaiImageModelOptions,
  openaiImageModelGenerationOptions,
  openaiImageModelEditOptions,
  OpenAIImageModel,
  applyPatchInputSchema,
  applyPatchOutputSchema,
  applyPatchArgsSchema,
  applyPatchToolFactory,
  applyPatch,
  codeInterpreterInputSchema,
  codeInterpreterOutputSchema,
  codeInterpreterArgsSchema,
  codeInterpreterToolFactory,
  codeInterpreter,
  computer,
  customTool,
  fileSearchArgsSchema,
  fileSearchOutputSchema,
  fileSearch,
  imageGenerationArgsSchema,
  imageGenerationOutputSchema,
  imageGeneration,
  localShell,
  shell,
  toolSearch,
  webSearchArgsSchema,
  webSearchOutputSchema,
  webSearchToolFactory,
  webSearch,
  webSearchPreviewArgsSchema,
  webSearchPreviewInputSchema,
  webSearchPreview,
  mcp,
  programmaticToolCallingInputSchema,
  programmaticToolCallingOutputSchema,
  programmaticToolCalling,
  convertOpenAIResponsesUsage,
  mapOpenAIResponseFinishReason,
  openaiResponsesResponseSchema,
  OpenAIResponsesLanguageModel,
  openaiSpeechModelOptionsSchema,
  OpenAISpeechModel,
  openAITranscriptionModelOptions,
  OpenAITranscriptionModel
};
