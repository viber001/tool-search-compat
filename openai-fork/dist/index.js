import {
  OpenAIChatLanguageModel,
  OpenAICompletionLanguageModel,
  OpenAIEmbeddingModel,
  OpenAIImageModel,
  OpenAIResponsesLanguageModel,
  OpenAISpeechModel,
  OpenAITranscriptionModel,
  applyPatch,
  codeInterpreter,
  computer,
  convertOpenAIResponsesUsage,
  customTool,
  fileSearch,
  imageGeneration,
  localShell,
  mapOpenAIResponseFinishReason,
  mcp,
  openaiErrorDataSchema,
  openaiFailedResponseHandler,
  openaiResponsesResponseSchema,
  programmaticToolCalling,
  shell,
  toolSearch,
  webSearch,
  webSearchPreview
} from "./chunk-S44C6F4T.js";

// src/openai-provider.ts
import {
  loadApiKey,
  loadOptionalSetting,
  validateBaseURL,
  withoutTrailingSlash,
  withUserAgentSuffix
} from "@ai-sdk/provider-utils";

// src/files/openai-files.ts
import {
  combineHeaders,
  convertInlineFileDataToUint8Array,
  createJsonResponseHandler,
  parseProviderOptions,
  postFormDataToApi
} from "@ai-sdk/provider-utils";

// src/files/openai-files-api.ts
import { lazySchema, zodSchema } from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
var openaiFilesResponseSchema = lazySchema(
  () => zodSchema(
    z.object({
      id: z.string(),
      object: z.string().nullish(),
      bytes: z.number().nullish(),
      created_at: z.number().nullish(),
      filename: z.string().nullish(),
      purpose: z.string().nullish(),
      status: z.string().nullish(),
      expires_at: z.number().nullish()
    })
  )
);

// src/files/openai-files-options.ts
import {
  lazySchema as lazySchema2,
  zodSchema as zodSchema2
} from "@ai-sdk/provider-utils";
import { z as z2 } from "zod/v4";
var openaiFilesOptionsSchema = lazySchema2(
  () => zodSchema2(
    z2.object({
      /*
       * Required by the OpenAI API, but optional here because
       * the SDK defaults to "assistants" — by far the most common
       * purpose when uploading files in this context.
       */
      purpose: z2.string().optional(),
      expiresAfter: z2.number().optional()
    })
  )
);

// src/files/openai-files.ts
var OpenAIFiles = class {
  constructor(config) {
    this.config = config;
  }
  config;
  specificationVersion = "v4";
  get provider() {
    return this.config.provider;
  }
  async uploadFile({
    data,
    mediaType,
    filename,
    providerOptions
  }) {
    const openaiOptions = await parseProviderOptions({
      provider: "openai",
      providerOptions,
      schema: openaiFilesOptionsSchema
    });
    const fileBytes = convertInlineFileDataToUint8Array(data);
    const blob = new Blob([fileBytes], {
      type: mediaType
    });
    const formData = new FormData();
    if (filename != null) {
      formData.append("file", blob, filename);
    } else {
      formData.append("file", blob);
    }
    formData.append("purpose", openaiOptions?.purpose ?? "assistants");
    if (openaiOptions?.expiresAfter != null) {
      formData.append("expires_after[anchor]", "created_at");
      formData.append(
        "expires_after[seconds]",
        String(openaiOptions.expiresAfter)
      );
    }
    const { value: response } = await postFormDataToApi({
      url: `${this.config.baseURL}/files`,
      headers: combineHeaders(this.config.headers()),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiFilesResponseSchema
      ),
      fetch: this.config.fetch
    });
    return {
      warnings: [],
      providerReference: { openai: response.id },
      ...response.filename ?? filename ? { filename: response.filename ?? filename } : {},
      ...mediaType != null ? { mediaType } : {},
      providerMetadata: {
        openai: {
          ...response.filename != null ? { filename: response.filename } : {},
          ...response.purpose != null ? { purpose: response.purpose } : {},
          ...response.bytes != null ? { bytes: response.bytes } : {},
          ...response.created_at != null ? { createdAt: response.created_at } : {},
          ...response.status != null ? { status: response.status } : {},
          ...response.expires_at != null ? { expiresAt: response.expires_at } : {}
        }
      }
    };
  }
};

// src/openai-tools.ts
var openaiTools = {
  /**
   * The apply_patch tool lets GPT-5.1 create, update, and delete files in your
   * codebase using structured diffs. Instead of just suggesting edits, the model
   * emits patch operations that your application applies and then reports back on,
   * enabling iterative, multi-step code editing workflows.
   *
   */
  applyPatch,
  /**
   * Custom tools let callers constrain model output to a grammar (regex or
   * Lark syntax). The model returns a `custom_tool_call` output item whose
   * `input` field is a string matching the specified grammar.
   *
   * @param description - An optional description of the tool.
   * @param format - The output format constraint (grammar type, syntax, and definition).
   */
  customTool,
  /**
   * The Code Interpreter tool allows models to write and run Python code in a
   * sandboxed environment to solve complex problems in domains like data analysis,
   * coding, and math.
   *
   * @param container - The container to use for the code interpreter.
   */
  codeInterpreter,
  /**
   * The computer tool allows models to operate a browser or desktop through
   * batched UI actions. Your application executes the actions and returns an
   * updated screenshot.
   *
   * WARNING: Run computer use in an isolated environment, treat on-screen
   * content as untrusted, and require confirmation for consequential actions.
   */
  computer,
  /**
   * File search is a tool available in the Responses API. It enables models to
   * retrieve information in a knowledge base of previously uploaded files through
   * semantic and keyword search.
   *
   * @param vectorStoreIds - The vector store IDs to use for the file search.
   * @param maxNumResults - The maximum number of results to return.
   * @param ranking - The ranking options to use for the file search.
   * @param filters - The filters to use for the file search.
   */
  fileSearch,
  /**
   * The image generation tool allows you to generate images using a text prompt,
   * and optionally image inputs. It leverages the GPT Image model,
   * and automatically optimizes text inputs for improved performance.
   *
   * @param background - Background type for the generated image. One of 'auto', 'opaque', or 'transparent'.
   * @param inputFidelity - Input fidelity for the generated image. One of 'low' or 'high'.
   * @param inputImageMask - Optional mask for inpainting. Contains fileId and/or imageUrl.
   * @param model - The image generation model to use. Default: gpt-image-1.
   * @param moderation - Moderation level for the generated image. Default: 'auto'.
   * @param outputCompression - Compression level for the output image (0-100).
   * @param outputFormat - The output format of the generated image. One of 'png', 'jpeg', or 'webp'.
   * @param partialImages - Number of partial images to generate in streaming mode (0-3).
   * @param quality - The quality of the generated image. One of 'auto', 'low', 'medium', or 'high'.
   * @param size - The size of the generated image. One of 'auto', '1024x1024', '1024x1536', or '1536x1024'.
   */
  imageGeneration,
  /**
   * Local shell is a tool that allows agents to run shell commands locally
   * on a machine you or the user provides.
   *
   * Supported models: `gpt-5-codex`
   */
  localShell,
  /**
   * The shell tool allows the model to interact with your local computer through
   * a controlled command-line interface. The model proposes shell commands; your
   * integration executes them and returns the outputs.
   *
   * Available through the Responses API for use with GPT-5.1.
   *
   * WARNING: Running arbitrary shell commands can be dangerous. Always sandbox
   * execution or add strict allow-/deny-lists before forwarding a command to
   * the system shell.
   */
  shell,
  /**
   * Web search allows models to access up-to-date information from the internet
   * and provide answers with sourced citations.
   *
   * @param searchContextSize - The search context size to use for the web search.
   * @param userLocation - The user location to use for the web search.
   */
  webSearchPreview,
  /**
   * Web search allows models to access up-to-date information from the internet
   * and provide answers with sourced citations.
   *
   * @param filters - The filters to use for the web search.
   * @param searchContextSize - The search context size to use for the web search.
   * @param userLocation - The user location to use for the web search.
   */
  webSearch,
  /**
   * MCP (Model Context Protocol) allows models to call tools exposed by
   * remote MCP servers or service connectors.
   *
   * @param serverLabel - Label to identify the MCP server.
   * @param allowedTools - Allowed tool names or filter object.
   * @param authorization - OAuth access token for the MCP server/connector.
   * @param connectorId - Identifier for a service connector.
   * @param headers - Optional headers to include in MCP requests.
   * // param requireApproval - Approval policy ('always'|'never'|filter object). (Removed - always 'never')
   * @param serverDescription - Optional description of the server.
   * @param serverUrl - URL for the MCP server.
   */
  mcp,
  /**
   * Programmatic Tool Calling lets OpenAI Responses models write and execute
   * JavaScript that orchestrates eligible tools.
   */
  programmaticToolCalling,
  /**
   * Tool search allows the model to dynamically search for and load deferred
   * tools into the model's context as needed. This helps reduce overall token
   * usage, cost, and latency by only loading tools when the model needs them.
   *
   * To use tool search, mark functions or namespaces with `defer_loading: true`
   * in the tools array. The model will use tool search to load these tools
   * when it determines they are needed.
   */
  toolSearch
};

// src/openai-responses-batch.ts
import {
  EmptyResponseBodyError,
  InvalidArgumentError
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders2,
  convertAsyncIteratorToReadableStream,
  createJsonResponseHandler as createJsonResponseHandler2,
  getFromApi,
  lazySchema as lazySchema3,
  parseJSON,
  postJsonToApi,
  postToApi,
  safeValidateTypes,
  validateTypes,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  zodSchema as zodSchema3
} from "@ai-sdk/provider-utils";
import { z as z3 } from "zod/v4";
var openaiBatchEndpoint = "/v1/responses";
var openaiBatchInputFileExpiresAfterSeconds = 48 * 60 * 60;
var openaiBatchResponseSchema = lazySchema3(
  () => zodSchema3(
    z3.object({
      id: z3.string(),
      status: z3.string(),
      output_file_id: z3.string().nullish(),
      error_file_id: z3.string().nullish(),
      created_at: z3.number().nullish(),
      expires_at: z3.number().nullish(),
      request_counts: z3.object({
        total: z3.number().nullish(),
        completed: z3.number().nullish(),
        failed: z3.number().nullish()
      }).nullish(),
      errors: z3.object({
        data: z3.array(
          z3.object({
            code: z3.string().nullish(),
            message: z3.string().nullish()
          })
        ).nullish()
      }).nullish()
    })
  )
);
var openaiBatchResultLineSchema = lazySchema3(
  () => zodSchema3(
    z3.object({
      custom_id: z3.string(),
      response: z3.object({
        status_code: z3.number(),
        request_id: z3.string().nullish(),
        body: z3.unknown()
      }).nullish(),
      error: z3.object({
        code: z3.string(),
        message: z3.string()
      }).nullish()
    })
  )
);
var OpenAIResponsesBatch = class {
  constructor(options) {
    this.options = options;
  }
  options;
  async startBatch(options) {
    const fileParts = [];
    const warnings = [];
    for (const request of options.requests) {
      const preparedRequest = await this.options.prepareRequest(request);
      fileParts.push(
        JSON.stringify({
          custom_id: request.id,
          method: "POST",
          url: openaiBatchEndpoint,
          body: preparedRequest.body
        }),
        "\n"
      );
      for (const warning of preparedRequest.warnings) {
        warnings.push({ requestId: request.id, warning });
      }
    }
    const filename = "batch.jsonl";
    const file = new Blob(fileParts, {
      type: "application/jsonl"
    });
    fileParts.length = 0;
    const formData = new FormData();
    formData.append("file", file, filename);
    formData.append("purpose", "batch");
    formData.append("expires_after[anchor]", "created_at");
    formData.append(
      "expires_after[seconds]",
      String(openaiBatchInputFileExpiresAfterSeconds)
    );
    const { value: uploadedFile } = await postToApi({
      url: this.getUrl("/files"),
      headers: combineHeaders2(this.options.config.headers?.(), options.headers),
      body: {
        content: formData,
        values: {
          purpose: "batch",
          "expires_after[anchor]": "created_at",
          "expires_after[seconds]": String(
            openaiBatchInputFileExpiresAfterSeconds
          ),
          file: {
            name: filename,
            type: file.type,
            size: file.size
          }
        }
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
        openaiFilesResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.options.config.fetch
    });
    const { value: batch } = await postJsonToApi({
      url: this.getUrl("/batches"),
      headers: combineHeaders2(this.options.config.headers?.(), options.headers),
      body: {
        input_file_id: uploadedFile.id,
        endpoint: openaiBatchEndpoint,
        completion_window: "24h"
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
        openaiBatchResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.options.config.fetch
    });
    return {
      batchId: batch.id,
      ...convertOpenAIBatchStatus(batch),
      warnings
    };
  }
  async getBatchStatus(options) {
    const batch = await this.retrieveBatch(options);
    return convertOpenAIBatchStatus(batch);
  }
  async getBatchResults(options) {
    const batch = await this.retrieveBatch(options);
    if (convertOpenAIBatchStatus(batch).status === "pending") {
      throw new InvalidArgumentError({
        argument: "batchId",
        message: `OpenAI batch "${options.batchId}" is not complete.`
      });
    }
    const fileIds = [batch.output_file_id, batch.error_file_id].filter(
      (fileId) => fileId != null
    );
    const iterator = this.iterateBatchResults({ fileIds, options });
    return convertAsyncIteratorToReadableStream(iterator);
  }
  async retrieveBatch(options) {
    const { value: batch } = await getFromApi({
      url: this.getUrl(`/batches/${encodeURIComponent(options.batchId)}`),
      headers: combineHeaders2(this.options.config.headers?.(), options.headers),
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
        openaiBatchResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.options.config.fetch,
      validateUrl: false
    });
    return batch;
  }
  async *iterateBatchResults({
    fileIds,
    options
  }) {
    for (const fileId of fileIds) {
      const { value: stream } = await getFromApi({
        url: this.getUrl(`/files/${encodeURIComponent(fileId)}/content`),
        headers: combineHeaders2(
          this.options.config.headers?.(),
          options.headers
        ),
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: rawStreamResponseHandler,
        abortSignal: options.abortSignal,
        fetch: this.options.config.fetch,
        validateUrl: false
      });
      for await (const line of parseJsonLines(stream)) {
        yield await this.convertResultLine(line);
      }
    }
  }
  async convertResultLine(line) {
    if (line.error != null) {
      const error = {
        message: line.error.message,
        code: line.error.code
      };
      if (line.error.code === "batch_cancelled") {
        return { id: line.custom_id, status: "cancelled", error };
      }
      if (line.error.code === "batch_expired") {
        return { id: line.custom_id, status: "expired", error };
      }
      return { id: line.custom_id, status: "failed", error };
    }
    if (line.response == null) {
      return {
        id: line.custom_id,
        status: "failed",
        error: {
          message: "OpenAI returned a batch result without a response or error.",
          code: "invalid_batch_result"
        }
      };
    }
    if (line.response.status_code < 200 || line.response.status_code >= 300) {
      return {
        id: line.custom_id,
        status: "failed",
        error: await convertOpenAIErrorResponse({
          body: line.response.body,
          statusCode: line.response.status_code
        })
      };
    }
    const conversion = await convertOpenAIResponsesBatchResponse(
      line.response.body
    );
    if (!conversion.success) {
      return {
        id: line.custom_id,
        status: "failed",
        error: conversion.error
      };
    }
    return {
      id: line.custom_id,
      status: "succeeded",
      result: conversion.result
    };
  }
  getUrl(path) {
    return this.options.config.url({
      modelId: this.options.modelId,
      path
    });
  }
};
var OpenAIResponsesBatchLanguageModel = class _OpenAIResponsesBatchLanguageModel extends OpenAIResponsesLanguageModel {
  batch;
  static [WORKFLOW_SERIALIZE](model) {
    return OpenAIResponsesLanguageModel[WORKFLOW_SERIALIZE](model);
  }
  static [WORKFLOW_DESERIALIZE](options) {
    return new _OpenAIResponsesBatchLanguageModel(
      options.modelId,
      options.config
    );
  }
  constructor(modelId, config) {
    super(modelId, config);
    this.batch = new OpenAIResponsesBatch({
      modelId,
      config,
      prepareRequest: async (request) => {
        const { args: body, warnings } = await this.getArgs(request.options);
        return { body, warnings };
      }
    });
  }
  experimental_doStartBatch(options) {
    return this.batch.startBatch(options);
  }
  experimental_doGetBatchStatus(options) {
    return this.batch.getBatchStatus(options);
  }
  experimental_doGetBatchResults(options) {
    return this.batch.getBatchResults(options);
  }
};
function convertOpenAIBatchStatus(batch) {
  const status = mapOpenAIBatchStatus(batch.status);
  const firstError = batch.errors?.data?.[0];
  const requestCounts = convertOpenAIRequestCounts(batch.request_counts);
  const createdAt = convertUnixTimestamp(batch.created_at);
  const expiresAt = convertUnixTimestamp(batch.expires_at);
  return {
    status,
    rawStatus: batch.status,
    ...requestCounts != null ? { requestCounts } : {},
    ...firstError != null ? {
      error: {
        message: firstError.message ?? "OpenAI batch failed.",
        ...firstError.code != null ? { code: firstError.code } : {}
      }
    } : {},
    ...createdAt != null ? { createdAt } : {},
    ...expiresAt != null ? { expiresAt } : {}
  };
}
function mapOpenAIBatchStatus(rawStatus) {
  switch (rawStatus) {
    case "completed":
      return "completed";
    case "failed":
    case "expired":
    case "cancelled":
      return "failed";
    case "validating":
    case "in_progress":
    case "finalizing":
    case "cancelling":
    default:
      return "pending";
  }
}
function convertOpenAIRequestCounts(counts) {
  const total = counts?.total;
  const completed = counts?.completed;
  const failed = counts?.failed;
  if (total == null || completed == null || failed == null || total < 0 || completed < 0 || failed < 0 || completed + failed > total) {
    return void 0;
  }
  return {
    total,
    pending: total - completed - failed,
    completed,
    failed
  };
}
function convertUnixTimestamp(value) {
  if (value == null || !Number.isFinite(value)) {
    return void 0;
  }
  const date = new Date(value * 1e3);
  return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
}
async function convertOpenAIErrorResponse({
  body,
  statusCode
}) {
  const result = await safeValidateTypes({
    value: body,
    schema: openaiErrorDataSchema
  });
  if (!result.success) {
    return {
      message: `OpenAI batch request failed with status code ${statusCode}.`,
      statusCode
    };
  }
  return {
    message: result.value.error.message,
    type: result.value.error.type ?? void 0,
    code: result.value.error.code != null ? String(result.value.error.code) : void 0,
    statusCode
  };
}
async function convertOpenAIResponsesBatchResponse(body) {
  const response = await validateTypes({
    value: body,
    schema: openaiResponsesResponseSchema
  });
  if (response.error != null) {
    return {
      success: false,
      error: {
        message: response.error.message,
        type: response.error.type,
        code: response.error.code
      }
    };
  }
  if (response.output == null) {
    const detail = response.incomplete_details?.reason;
    return {
      success: false,
      error: {
        message: detail != null ? `OpenAI Responses returned no output (${detail}).` : "OpenAI Responses returned no output.",
        code: "invalid_response"
      }
    };
  }
  const content = [];
  const logprobs = [];
  for (const part of response.output) {
    if (part.type === "message") {
      for (const contentPart of part.content) {
        content.push({ type: "text", text: contentPart.text });
        if (contentPart.logprobs != null) {
          logprobs.push(contentPart.logprobs);
        }
      }
    } else if (part.type === "function_call" || part.type === "custom_tool_call") {
      return {
        success: false,
        error: {
          message: "OpenAI returned a tool call, but tool calls are not supported in AI SDK text batches.",
          code: "unsupported_tool_call"
        }
      };
    }
  }
  const providerMetadata = {
    openai: {
      responseId: response.id,
      ...logprobs.length > 0 ? { logprobs } : {},
      ...typeof response.service_tier === "string" ? { serviceTier: response.service_tier } : {},
      ...response.reasoning?.context != null ? { reasoningContext: response.reasoning.context } : {}
    }
  };
  return {
    success: true,
    result: {
      content,
      finishReason: {
        unified: mapOpenAIResponseFinishReason({
          finishReason: response.incomplete_details?.reason,
          hasFunctionCall: false
        }),
        raw: response.incomplete_details?.reason ?? void 0
      },
      usage: convertOpenAIResponsesUsage(response.usage),
      response: {
        id: response.id,
        timestamp: response.created_at != null ? new Date(response.created_at * 1e3) : void 0,
        modelId: response.model
      },
      providerMetadata,
      warnings: []
    }
  };
}
var rawStreamResponseHandler = async ({ response }) => {
  if (response.body == null) {
    throw new EmptyResponseBodyError();
  }
  return { value: response.body };
};
async function* parseJsonLines(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let lineEnd = buffer.indexOf("\n");
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
        buffer = buffer.slice(lineEnd + 1);
        if (line.trim().length > 0) {
          yield await parseJSON({
            text: line,
            schema: openaiBatchResultLineSchema
          });
        }
        lineEnd = buffer.indexOf("\n");
      }
    }
    const finalLine = buffer.replace(/\r$/, "");
    if (finalLine.trim().length > 0) {
      yield await parseJSON({
        text: finalLine,
        schema: openaiBatchResultLineSchema
      });
    }
  } finally {
    if (!finished) {
      await reader.cancel().catch(() => {
      });
    }
    reader.releaseLock();
  }
}

// src/realtime/openai-realtime-event-mapper.ts
function parseOpenAIRealtimeServerEvent(raw) {
  const event = raw;
  const type = event.type;
  switch (type) {
    // ── Session lifecycle ──────────────────────────────────────────
    case "session.created":
      return {
        type: "session-created",
        sessionId: event.session?.id,
        raw
      };
    case "session.updated":
      return { type: "session-updated", raw };
    // ── Input audio buffer ─────────────────────────────────────────
    case "input_audio_buffer.speech_started":
      return {
        type: "speech-started",
        itemId: event.item_id,
        raw
      };
    case "input_audio_buffer.speech_stopped":
      return {
        type: "speech-stopped",
        itemId: event.item_id,
        raw
      };
    case "input_audio_buffer.committed":
      return {
        type: "audio-committed",
        itemId: event.item_id,
        previousItemId: event.previous_item_id,
        raw
      };
    // ── Conversation items ─────────────────────────────────────────
    case "conversation.item.added":
      return {
        type: "conversation-item-added",
        itemId: event.item?.id ?? event.item_id,
        item: event.item,
        raw
      };
    case "conversation.item.input_audio_transcription.completed":
      return {
        type: "input-transcription-completed",
        itemId: event.item_id,
        transcript: event.transcript ?? "",
        raw
      };
    // ── Response lifecycle ──────────────────────────────────────────
    case "response.created":
      return {
        type: "response-created",
        responseId: event.response?.id ?? event.response_id,
        raw
      };
    case "response.done":
      return {
        type: "response-done",
        responseId: event.response?.id ?? event.response_id,
        status: event.response?.status ?? "completed",
        raw
      };
    // ── Output item lifecycle ───────────────────────────────────────
    case "response.output_item.added":
      return {
        type: "output-item-added",
        responseId: event.response_id,
        itemId: event.item?.id ?? event.item_id,
        raw
      };
    case "response.output_item.done":
      return {
        type: "output-item-done",
        responseId: event.response_id,
        itemId: event.item?.id ?? event.item_id,
        raw
      };
    case "response.content_part.added":
      return {
        type: "content-part-added",
        responseId: event.response_id,
        itemId: event.item_id,
        raw
      };
    case "response.content_part.done":
      return {
        type: "content-part-done",
        responseId: event.response_id,
        itemId: event.item_id,
        raw
      };
    // ── Audio output ────────────────────────────────────────────────
    case "response.output_audio.delta":
      return {
        type: "audio-delta",
        responseId: event.response_id,
        itemId: event.item_id,
        delta: event.delta,
        raw
      };
    case "response.output_audio.done":
      return {
        type: "audio-done",
        responseId: event.response_id,
        itemId: event.item_id,
        raw
      };
    // ── Audio transcript output ─────────────────────────────────────
    case "response.output_audio_transcript.delta":
      return {
        type: "audio-transcript-delta",
        responseId: event.response_id,
        itemId: event.item_id,
        delta: event.delta,
        raw
      };
    case "response.output_audio_transcript.done":
      return {
        type: "audio-transcript-done",
        responseId: event.response_id,
        itemId: event.item_id,
        transcript: event.transcript,
        raw
      };
    // ── Text output ─────────────────────────────────────────────────
    case "response.output_text.delta":
      return {
        type: "text-delta",
        responseId: event.response_id,
        itemId: event.item_id,
        delta: event.delta,
        raw
      };
    case "response.output_text.done":
      return {
        type: "text-done",
        responseId: event.response_id,
        itemId: event.item_id,
        text: event.text,
        raw
      };
    // ── Function calling ────────────────────────────────────────────
    case "response.function_call_arguments.delta":
      return {
        type: "function-call-arguments-delta",
        responseId: event.response_id,
        itemId: event.item_id,
        callId: event.call_id,
        delta: event.delta,
        raw
      };
    case "response.function_call_arguments.done":
      return {
        type: "function-call-arguments-done",
        responseId: event.response_id,
        itemId: event.item_id,
        callId: event.call_id,
        name: event.name,
        arguments: event.arguments,
        raw
      };
    // ── Error ───────────────────────────────────────────────────────
    case "error":
      return {
        type: "error",
        message: event.error?.message ?? event.message ?? "Unknown error",
        code: event.error?.code ?? event.code,
        raw
      };
    // ── Pass-through ────────────────────────────────────────────────
    default:
      return { type: "custom", rawType: type, raw };
  }
}
function serializeOpenAIRealtimeClientEvent(event, modelId) {
  switch (event.type) {
    case "session-update":
      return {
        type: "session.update",
        session: buildOpenAISessionConfig(event.config, modelId)
      };
    case "input-audio-append":
      return {
        type: "input_audio_buffer.append",
        audio: event.audio
      };
    case "input-audio-commit":
      return { type: "input_audio_buffer.commit" };
    case "input-audio-clear":
      return { type: "input_audio_buffer.clear" };
    case "conversation-item-create": {
      const item = event.item;
      switch (item.type) {
        case "text-message":
          return {
            type: "conversation.item.create",
            item: {
              type: "message",
              role: item.role,
              content: [{ type: "input_text", text: item.text }]
            }
          };
        case "audio-message":
          return {
            type: "conversation.item.create",
            item: {
              type: "message",
              role: item.role,
              content: [{ type: "input_audio", audio: item.audio }]
            }
          };
        case "function-call-output":
          return {
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: item.callId,
              output: item.output
            }
          };
      }
      break;
    }
    case "conversation-item-truncate":
      return {
        type: "conversation.item.truncate",
        item_id: event.itemId,
        content_index: event.contentIndex,
        audio_end_ms: event.audioEndMs
      };
    case "response-create":
      return {
        type: "response.create",
        ...event.options != null ? {
          response: {
            ...event.options.modalities != null ? { output_modalities: event.options.modalities } : {},
            ...event.options.instructions != null ? { instructions: event.options.instructions } : {},
            ...event.options.metadata != null ? { metadata: event.options.metadata } : {}
          }
        } : {}
      };
    case "response-cancel":
      return { type: "response.cancel" };
  }
}
function buildOpenAISessionConfig(config, modelId) {
  const session = {
    type: "realtime",
    model: modelId
  };
  if (config.instructions != null) {
    session.instructions = config.instructions;
  }
  if (config.outputModalities != null) {
    session.output_modalities = config.outputModalities;
  }
  const audio = {};
  if (config.inputAudioFormat != null || config.inputAudioTranscription != null || config.turnDetection != null) {
    const input = {};
    if (config.inputAudioFormat != null) {
      input.format = {
        type: config.inputAudioFormat.type,
        ...config.inputAudioFormat.rate != null ? { rate: config.inputAudioFormat.rate } : {}
      };
    }
    if (config.turnDetection != null) {
      if (config.turnDetection.type === "disabled") {
        input.turn_detection = null;
      } else {
        const td = {
          type: config.turnDetection.type === "server-vad" ? "server_vad" : "semantic_vad"
        };
        if (config.turnDetection.threshold != null) {
          td.threshold = config.turnDetection.threshold;
        }
        if (config.turnDetection.silenceDurationMs != null) {
          td.silence_duration_ms = config.turnDetection.silenceDurationMs;
        }
        if (config.turnDetection.prefixPaddingMs != null) {
          td.prefix_padding_ms = config.turnDetection.prefixPaddingMs;
        }
        input.turn_detection = td;
      }
    }
    if (config.inputAudioTranscription != null) {
      input.transcription = {
        model: config.inputAudioTranscription.model ?? "gpt-realtime-whisper",
        ...config.inputAudioTranscription.language != null ? { language: config.inputAudioTranscription.language } : {},
        ...config.inputAudioTranscription.prompt != null ? { prompt: config.inputAudioTranscription.prompt } : {}
      };
    }
    audio.input = input;
  }
  if (config.outputAudioFormat != null || config.voice != null) {
    const output = {};
    if (config.outputAudioFormat != null) {
      output.format = {
        type: config.outputAudioFormat.type,
        ...config.outputAudioFormat.rate != null ? { rate: config.outputAudioFormat.rate } : {}
      };
    }
    if (config.voice != null) {
      output.voice = config.voice;
    }
    audio.output = output;
  }
  if (Object.keys(audio).length > 0) {
    session.audio = audio;
  }
  if (config.tools != null && config.tools.length > 0) {
    session.tools = config.tools.map((tool) => ({
      type: tool.type,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
    session.tool_choice = "auto";
  }
  if (config.providerOptions != null) {
    Object.assign(session, config.providerOptions);
  }
  return session;
}

// src/realtime/openai-realtime-model.ts
var OpenAIRealtimeModel = class {
  specificationVersion = "v4";
  provider;
  modelId;
  config;
  constructor(modelId, config) {
    this.modelId = modelId;
    this.provider = config.provider;
    this.config = config;
  }
  async doCreateClientSecret(options) {
    const fetchFn = this.config.fetch ?? fetch;
    const url = `${this.config.baseURL}/realtime/client_secrets`;
    const session = options.sessionConfig != null ? buildOpenAISessionConfig(options.sessionConfig, this.modelId) : { type: "realtime", model: this.modelId };
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        ...this.config.headers(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session,
        ...options.expiresAfterSeconds != null ? {
          // `anchor` is required by the client secrets endpoint; without it
          // the request fails with "Missing required parameter:
          // 'expires_after.anchor'".
          expires_after: {
            anchor: "created_at",
            seconds: options.expiresAfterSeconds
          }
        } : {}
      })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `OpenAI realtime client secret request failed: ${response.status} ${text}`
      );
    }
    const data = await response.json();
    return {
      token: data.value,
      url: `wss://${new URL(this.config.baseURL).host}/v1/realtime?model=${encodeURIComponent(this.modelId)}`,
      expiresAt: data.expires_at
    };
  }
  getWebSocketConfig(options) {
    return {
      url: options.url,
      protocols: ["realtime", `openai-insecure-api-key.${options.token}`]
    };
  }
  parseServerEvent(raw) {
    return parseOpenAIRealtimeServerEvent(raw);
  }
  serializeClientEvent(event) {
    return serializeOpenAIRealtimeClientEvent(event, this.modelId);
  }
  buildSessionConfig(config) {
    return buildOpenAISessionConfig(config, this.modelId);
  }
};

// src/speech-translation/openai-speech-translation-model.ts
import {
  InvalidArgumentError as InvalidArgumentError2
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders3,
  connectToWebSocket,
  convertToBase64,
  parseProviderOptions as parseProviderOptions2,
  safeParseJSON,
  serializeModelOptions,
  toWebSocketUrl,
  WORKFLOW_DESERIALIZE as WORKFLOW_DESERIALIZE2,
  WORKFLOW_SERIALIZE as WORKFLOW_SERIALIZE2,
  waitForWebSocketBufferDrain
} from "@ai-sdk/provider-utils";

// src/speech-translation/openai-speech-translation-model-options.ts
import {
  lazySchema as lazySchema4,
  zodSchema as zodSchema4
} from "@ai-sdk/provider-utils";
import { z as z4 } from "zod/v4";
var openAISpeechTranslationModelOptions = lazySchema4(
  () => zodSchema4(z4.object({}))
);

// src/speech-translation/openai-speech-translation-model.ts
var OpenAISpeechTranslationModel = class _OpenAISpeechTranslationModel {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
  }
  modelId;
  config;
  specificationVersion = "v4";
  static [WORKFLOW_SERIALIZE2](model) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config
    });
  }
  static [WORKFLOW_DESERIALIZE2](options) {
    return new _OpenAISpeechTranslationModel(options.modelId, options.config);
  }
  get provider() {
    return this.config.provider;
  }
  async doStream(options) {
    if (options.targetLanguage == null) {
      throw new InvalidArgumentError2({
        argument: "targetLanguage",
        message: `targetLanguage is required for translation model '${this.modelId}'.`
      });
    }
    const currentDate = this.config._internal?.currentDate?.() ?? /* @__PURE__ */ new Date();
    await parseProviderOptions2({
      provider: "openai",
      providerOptions: options.providerOptions,
      schema: openAISpeechTranslationModelOptions
    });
    const warnings = [];
    validateOpenAISpeechTranslationInputAudioFormat(options.inputAudioFormat);
    if (options.sourceLanguage != null) {
      warnings.push({
        type: "unsupported",
        feature: "sourceLanguage",
        details: "The OpenAI Realtime translation API auto-detects the source language and does not accept a source language."
      });
    }
    if (options.outputAudioFormat != null) {
      warnings.push({
        type: "unsupported",
        feature: "outputAudioFormat",
        details: "The OpenAI Realtime translation API always outputs 24kHz 16-bit PCM audio and does not accept an output audio format."
      });
    }
    const headers = combineHeaders3(this.config.headers?.(), options.headers);
    const sessionUpdate = buildOpenAIRealtimeSpeechTranslationSession({
      targetLanguage: options.targetLanguage
    });
    return {
      request: { body: sessionUpdate },
      response: {
        timestamp: currentDate,
        modelId: this.modelId
      },
      stream: createOpenAIRealtimeSpeechTranslationStream({
        webSocket: this.config.webSocket,
        url: toWebSocketUrl(
          this.config.url({
            path: `/realtime/translations?model=${encodeURIComponent(this.modelId)}`,
            modelId: this.modelId
          })
        ),
        headers,
        sessionUpdate,
        warnings,
        audio: options.audio,
        abortSignal: options.abortSignal,
        includeRawChunks: options.includeRawChunks
      })
    };
  }
};
function createOpenAIRealtimeSpeechTranslationStream({
  webSocket,
  url,
  headers,
  sessionUpdate,
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
      let sourceText = "";
      let translationText = "";
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
      const finish = () => {
        if (finished) return;
        finished = true;
        if (sourceText !== "") {
          controller.enqueue({
            type: "source-transcript-final",
            text: sourceText
          });
        }
        if (translationText !== "") {
          controller.enqueue({
            type: "output-text-final",
            text: translationText
          });
        }
        controller.enqueue({
          type: "finish",
          sourceText,
          outputText: translationText,
          usage: void 0
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
                type: "session.input_audio_buffer.append",
                audio: convertToBase64(value)
              })
            );
            await waitForWebSocketBufferDrain(socket);
          }
        } finally {
          audioReader.releaseLock();
          audioReader = void 0;
        }
        if (!finished) {
          socket.send(JSON.stringify({ type: "session.close" }));
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
          if (finished) return;
          const parsed = await safeParseJSON({ text });
          if (!parsed.success) return;
          const raw = parsed.value;
          if (includeRawChunks) {
            controller.enqueue({ type: "raw", rawValue: raw });
          }
          switch (raw.type) {
            case "session.output_audio.delta": {
              if (raw.delta) {
                controller.enqueue({
                  type: "audio",
                  audio: raw.delta
                });
              }
              break;
            }
            case "session.output_transcript.delta": {
              translationText += raw.delta ?? "";
              controller.enqueue({
                type: "output-text-delta",
                delta: raw.delta ?? ""
              });
              break;
            }
            case "session.input_transcript.delta": {
              sourceText += raw.delta ?? "";
              controller.enqueue({
                type: "source-transcript-delta",
                delta: raw.delta ?? ""
              });
              break;
            }
            case "session.closed": {
              finish();
              break;
            }
            case "error": {
              controller.enqueue({
                type: "error",
                error: new Error(raw.error?.message ?? "OpenAI realtime error")
              });
              break;
            }
          }
        },
        onSocketError: () => {
          finishWithError(new Error("OpenAI realtime translation error"));
        },
        onClose: ({ code, reason }) => {
          if (finished) return;
          finishWithError(
            new Error(
              `OpenAI realtime translation WebSocket closed unexpectedly before finishing (code ${code ?? "unknown"}${reason ? `, reason: ${reason}` : ""}).`
            )
          );
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
function buildOpenAIRealtimeSpeechTranslationSession({
  targetLanguage
}) {
  return {
    type: "session.update",
    session: {
      audio: {
        input: {
          transcription: {
            model: "gpt-realtime-whisper"
          },
          noise_reduction: null
        },
        output: {
          language: targetLanguage
        }
      }
    }
  };
}
function validateOpenAISpeechTranslationInputAudioFormat(inputAudioFormat) {
  if (inputAudioFormat.type !== "audio/pcm" || inputAudioFormat.rate != null && inputAudioFormat.rate !== 24e3) {
    throw new InvalidArgumentError2({
      argument: "inputAudioFormat",
      message: "The OpenAI Realtime translation API only supports 24kHz 16-bit PCM input audio."
    });
  }
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

// src/skills/openai-skills.ts
import {
  combineHeaders as combineHeaders4,
  convertInlineFileDataToUint8Array as convertInlineFileDataToUint8Array2,
  createJsonResponseHandler as createJsonResponseHandler3,
  postFormDataToApi as postFormDataToApi2
} from "@ai-sdk/provider-utils";

// src/skills/openai-skills-api.ts
import { lazySchema as lazySchema5, zodSchema as zodSchema5 } from "@ai-sdk/provider-utils";
import { z as z5 } from "zod/v4";
var openaiSkillResponseSchema = lazySchema5(
  () => zodSchema5(
    z5.object({
      id: z5.string(),
      name: z5.string().nullish(),
      description: z5.string().nullish(),
      default_version: z5.string().nullish(),
      latest_version: z5.string().nullish(),
      created_at: z5.number(),
      updated_at: z5.number().nullish()
    })
  )
);
var openaiSkillVersionResponseSchema = lazySchema5(
  () => zodSchema5(
    z5.object({
      id: z5.string(),
      version: z5.string().nullish(),
      name: z5.string().nullish(),
      description: z5.string().nullish()
    })
  )
);

// src/skills/openai-skills.ts
var OpenAISkills = class {
  constructor(config) {
    this.config = config;
  }
  config;
  specificationVersion = "v4";
  get provider() {
    return this.config.provider;
  }
  async uploadSkill(params) {
    const warnings = [];
    if (params.displayTitle != null) {
      warnings.push({
        type: "unsupported",
        feature: "displayTitle"
      });
    }
    const formData = new FormData();
    for (const file of params.files) {
      const content = convertInlineFileDataToUint8Array2(file.data);
      formData.append("files[]", new Blob([content]), file.path);
    }
    const { value: response } = await postFormDataToApi2({
      url: this.config.url({ path: "/skills" }),
      headers: combineHeaders4(this.config.headers()),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler3(
        openaiSkillResponseSchema
      ),
      fetch: this.config.fetch
    });
    return {
      providerReference: { openai: response.id },
      ...response.name != null ? { name: response.name } : {},
      ...response.description != null ? { description: response.description } : {},
      ...response.latest_version != null ? { latestVersion: response.latest_version } : {},
      providerMetadata: {
        openai: {
          ...response.default_version != null ? { defaultVersion: response.default_version } : {},
          ...response.created_at != null ? { createdAt: response.created_at } : {},
          ...response.updated_at != null ? { updatedAt: response.updated_at } : {}
        }
      },
      warnings
    };
  }
};

// src/version.ts
var VERSION = typeof __PACKAGE_VERSION__ !== "undefined" ? __PACKAGE_VERSION__ : "0.0.0-test";

// src/openai-provider.ts
function createOpenAI(options = {}) {
  const baseURL = withoutTrailingSlash(
    validateBaseURL(
      loadOptionalSetting({
        settingValue: options.baseURL,
        environmentVariableName: "OPENAI_BASE_URL"
      })
    )
  ) ?? "https://api.openai.com/v1";
  const providerName = options.name ?? "openai";
  const getHeaders = () => withUserAgentSuffix(
    {
      Authorization: `Bearer ${loadApiKey({
        apiKey: options.apiKey,
        environmentVariableName: "OPENAI_API_KEY",
        description: "OpenAI"
      })}`,
      "OpenAI-Organization": options.organization,
      "OpenAI-Project": options.project,
      ...options.headers
    },
    `ai-sdk/openai/${VERSION}`
  );
  const createChatModel = (modelId) => new OpenAIChatLanguageModel(modelId, {
    provider: `${providerName}.chat`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createCompletionModel = (modelId) => new OpenAICompletionLanguageModel(modelId, {
    provider: `${providerName}.completion`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createEmbeddingModel = (modelId) => new OpenAIEmbeddingModel(modelId, {
    provider: `${providerName}.embedding`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createImageModel = (modelId) => new OpenAIImageModel(modelId, {
    provider: `${providerName}.image`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createTranscriptionModel = (modelId) => new OpenAITranscriptionModel(modelId, {
    provider: `${providerName}.transcription`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch,
    webSocket: options.webSocket
  });
  const createSpeechTranslationModel = (modelId) => new OpenAISpeechTranslationModel(modelId, {
    provider: `${providerName}.speech-translation`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch,
    webSocket: options.webSocket
  });
  const createSpeechModel = (modelId) => new OpenAISpeechModel(modelId, {
    provider: `${providerName}.speech`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createFiles = () => new OpenAIFiles({
    provider: `${providerName}.files`,
    baseURL,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createSkills = () => new OpenAISkills({
    provider: `${providerName}.skills`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createLanguageModel = (modelId) => {
    if (new.target) {
      throw new Error(
        "The OpenAI model function cannot be called with the new keyword."
      );
    }
    return createResponsesModel(modelId);
  };
  const createResponsesModel = (modelId) => {
    return new OpenAIResponsesBatchLanguageModel(modelId, {
      provider: `${providerName}.responses`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      // Soft-deprecated. TODO: remove in v8
      fileIdPrefixes: ["file-"]
    });
  };
  const createRealtimeModel = (modelId) => new OpenAIRealtimeModel(modelId, {
    provider: `${providerName}.realtime`,
    baseURL,
    headers: getHeaders,
    fetch: options.fetch
  });
  const experimentalRealtimeFactory = Object.assign(
    (modelId) => createRealtimeModel(modelId),
    {
      getToken: async (tokenOptions) => {
        const model = createRealtimeModel(tokenOptions.model);
        const secret = await model.doCreateClientSecret({
          sessionConfig: tokenOptions.sessionConfig,
          expiresAfterSeconds: tokenOptions.expiresAfterSeconds
        });
        return {
          token: secret.token,
          url: secret.url,
          expiresAt: secret.expiresAt
        };
      }
    }
  );
  const provider = function(modelId) {
    return createLanguageModel(modelId);
  };
  provider.specificationVersion = "v4";
  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;
  provider.responses = createResponsesModel;
  provider.embedding = createEmbeddingModel;
  provider.embeddingModel = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;
  provider.translation = createSpeechTranslationModel;
  provider.speechTranslationModel = createSpeechTranslationModel;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;
  provider.files = createFiles;
  provider.skills = createSkills;
  provider.experimental_realtime = experimentalRealtimeFactory;
  provider.tools = openaiTools;
  return provider;
}
var openai = createOpenAI();
export {
  OpenAIRealtimeModel as Experimental_OpenAIRealtimeModel,
  OpenAISpeechTranslationModel as Experimental_OpenAISpeechTranslationModel,
  OpenAISpeechTranslationModel as Experimental_OpenAITranslationModel,
  VERSION,
  createOpenAI,
  openai
};
