import * as _ai_sdk_provider from '@ai-sdk/provider';
import { ProviderV4, Experimental_BatchLanguageModelV4, LanguageModelV4, EmbeddingModelV4, ImageModelV4, TranscriptionModelV4, Experimental_SpeechTranslationModelV4, SpeechModelV4, Experimental_RealtimeFactoryV4, FilesV4, SkillsV4, Experimental_RealtimeModelV4, Experimental_RealtimeModelV4ClientSecretOptions, Experimental_RealtimeModelV4ClientSecretResult, Experimental_RealtimeModelV4ServerEvent, Experimental_RealtimeModelV4ClientEvent, Experimental_RealtimeModelV4SessionConfig, JSONObject, Experimental_SpeechTranslationModelV4StreamOptions } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { InferSchema, FetchFunction, WebSocketConstructor, WORKFLOW_SERIALIZE, WORKFLOW_DESERIALIZE } from '@ai-sdk/provider-utils';
import { A as ApplyPatchOperation, O as OpenAIResponsesFileSearchToolComparisonFilter, a as OpenAIResponsesFileSearchToolCompoundFilter, w as webSearchToolFactory, b as OpenAIResponsesModelId, c as OpenAIChatModelId, d as OpenAICompletionModelId, e as OpenAIEmbeddingModelId, f as OpenAIImageModelId, g as OpenAITranscriptionModelId, h as OpenAISpeechModelId, i as OpenAIConfig } from './openai-responses-provider-metadata-C1tCYWSW.js';
export { j as OpenAIChatLanguageModelOptions, k as OpenAIEmbeddingModelOptions, l as OpenAIImageModelEditOptions, m as OpenAIImageModelGenerationOptions, n as OpenAIImageModelOptions, j as OpenAILanguageModelChatOptions, o as OpenAILanguageModelCompletionOptions, p as OpenAILanguageModelResponsesOptions, p as OpenAIResponsesProviderOptions, q as OpenAISpeechModelOptions, r as OpenAITranscriptionModelOptions, s as OpenaiResponsesCompactionProviderMetadata, t as OpenaiResponsesProviderMetadata, u as OpenaiResponsesReasoningProviderMetadata, v as OpenaiResponsesSourceDocumentProviderMetadata, x as OpenaiResponsesTextProviderMetadata } from './openai-responses-provider-metadata-C1tCYWSW.js';
import { z } from 'zod/v4';

declare const customToolFactory: _ai_sdk_provider_utils.ProviderDefinedToolFactory<string, {
    /**
     * An optional description of what the tool does.
     */
    description?: string;
    /**
     * The output format specification for the tool.
     * Omit for unconstrained text output.
     */
    format?: {
        type: "grammar";
        syntax: "regex" | "lark";
        definition: string;
    } | {
        type: "text";
    };
}, {}>;

declare const openaiTools: {
    /**
     * The apply_patch tool lets GPT-5.1 create, update, and delete files in your
     * codebase using structured diffs. Instead of just suggesting edits, the model
     * emits patch operations that your application applies and then reports back on,
     * enabling iterative, multi-step code editing workflows.
     *
     */
    applyPatch: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        callId: string;
        operation: ApplyPatchOperation;
    }, {
        status: "completed" | "failed";
        output?: string;
    }, {}, {}>;
    /**
     * Custom tools let callers constrain model output to a grammar (regex or
     * Lark syntax). The model returns a `custom_tool_call` output item whose
     * `input` field is a string matching the specified grammar.
     *
     * @param description - An optional description of the tool.
     * @param format - The output format constraint (grammar type, syntax, and definition).
     */
    customTool: (args: Parameters<typeof customToolFactory>[0]) => _ai_sdk_provider_utils.ProviderDefinedTool<string, unknown, {}>;
    /**
     * The Code Interpreter tool allows models to write and run Python code in a
     * sandboxed environment to solve complex problems in domains like data analysis,
     * coding, and math.
     *
     * @param container - The container to use for the code interpreter.
     */
    codeInterpreter: (args?: {
        container?: string | {
            fileIds?: string[];
        };
    }) => _ai_sdk_provider_utils.ProviderExecutedTool<{
        code?: string | null;
        containerId: string;
    }, {
        outputs?: Array<{
            type: "logs";
            logs: string;
        } | {
            type: "image";
            url: string;
        }> | null;
    }, {}>;
    /**
     * The computer tool allows models to operate a browser or desktop through
     * batched UI actions. Your application executes the actions and returns an
     * updated screenshot.
     *
     * WARNING: Run computer use in an isolated environment, treat on-screen
     * content as untrusted, and require confirmation for consequential actions.
     */
    computer: (options?: Parameters<_ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        actions: OpenAIComputerAction[];
        pendingSafetyChecks: OpenAIComputerSafetyCheck[];
        status: "in_progress" | "completed" | "incomplete";
    }, {
        output: {
            type: "computer_screenshot";
            imageUrl: string;
            fileId?: string;
            detail?: "auto" | "low" | "high" | "original";
        } | {
            type: "computer_screenshot";
            fileId: string;
            imageUrl?: string;
            detail?: "auto" | "low" | "high" | "original";
        };
        acknowledgedSafetyChecks?: OpenAIComputerSafetyCheck[];
    }, {}, {}>>[0]) => _ai_sdk_provider_utils.ProviderDefinedTool<{
        actions: OpenAIComputerAction[];
        pendingSafetyChecks: OpenAIComputerSafetyCheck[];
        status: "in_progress" | "completed" | "incomplete";
    }, {
        output: {
            type: "computer_screenshot";
            imageUrl: string;
            fileId?: string;
            detail?: "auto" | "low" | "high" | "original";
        } | {
            type: "computer_screenshot";
            fileId: string;
            imageUrl?: string;
            detail?: "auto" | "low" | "high" | "original";
        };
        acknowledgedSafetyChecks?: OpenAIComputerSafetyCheck[];
    }, {}>;
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
    fileSearch: _ai_sdk_provider_utils.ProviderExecutedToolFactory<{}, {
        queries: string[];
        results: null | {
            attributes: Record<string, unknown>;
            fileId: string;
            filename: string;
            score: number;
            text: string;
        }[];
    }, {
        vectorStoreIds: string[];
        maxNumResults?: number;
        ranking?: {
            ranker?: string;
            scoreThreshold?: number;
        };
        filters?: OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter;
    }, {}>;
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
    imageGeneration: (args?: {
        background?: "auto" | "opaque" | "transparent";
        inputFidelity?: "low" | "high";
        inputImageMask?: {
            fileId?: string;
            imageUrl?: string;
        };
        model?: string;
        moderation?: "auto";
        outputCompression?: number;
        outputFormat?: "png" | "jpeg" | "webp";
        partialImages?: number;
        quality?: "auto" | "low" | "medium" | "high";
        size?: "auto" | "1024x1024" | "1024x1536" | "1536x1024";
    }) => _ai_sdk_provider_utils.ProviderExecutedTool<{}, {
        result: string;
    }, {}>;
    /**
     * Local shell is a tool that allows agents to run shell commands locally
     * on a machine you or the user provides.
     *
     * Supported models: `gpt-5-codex`
     */
    localShell: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        action: {
            type: "exec";
            command: string[];
            timeoutMs?: number;
            user?: string;
            workingDirectory?: string;
            env?: Record<string, string>;
        };
    }, {
        output: string;
    }, {}, {}>;
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
    shell: _ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        action: {
            commands: string[];
            timeoutMs?: number;
            maxOutputLength?: number;
        };
    }, {
        output: Array<{
            stdout: string;
            stderr: string;
            outcome: {
                type: "timeout";
            } | {
                type: "exit";
                exitCode: number;
            };
        }>;
    }, {
        environment?: {
            type: "containerAuto";
            fileIds?: string[];
            memoryLimit?: "1g" | "4g" | "16g" | "64g";
            networkPolicy?: {
                type: "disabled";
            } | {
                type: "allowlist";
                allowedDomains: string[];
                domainSecrets?: Array<{
                    domain: string;
                    name: string;
                    value: string;
                }>;
            };
            skills?: Array<{
                type: "skillReference";
                providerReference: _ai_sdk_provider.SharedV4ProviderReference;
                version?: string;
            } | {
                type: "inline";
                name: string;
                description: string;
                source: {
                    type: "base64";
                    mediaType: "application/zip";
                    data: string;
                };
            }>;
        } | {
            type: "containerReference";
            containerId: string;
        } | {
            type?: "local";
            skills?: Array<{
                name: string;
                description: string;
                path: string;
            }>;
        };
    }, {}>;
    /**
     * Web search allows models to access up-to-date information from the internet
     * and provide answers with sourced citations.
     *
     * @param searchContextSize - The search context size to use for the web search.
     * @param userLocation - The user location to use for the web search.
     */
    webSearchPreview: _ai_sdk_provider_utils.ProviderExecutedToolFactory<{}, {
        action?: {
            type: "search";
            query?: string;
        } | {
            type: "openPage";
            url?: string | null;
        } | {
            type: "findInPage";
            url?: string | null;
            pattern?: string | null;
        };
    }, {
        searchContextSize?: "low" | "medium" | "high";
        userLocation?: {
            type: "approximate";
            country?: string;
            city?: string;
            region?: string;
            timezone?: string;
        };
    }, {}>;
    /**
     * Web search allows models to access up-to-date information from the internet
     * and provide answers with sourced citations.
     *
     * @param filters - The filters to use for the web search.
     * @param searchContextSize - The search context size to use for the web search.
     * @param userLocation - The user location to use for the web search.
     */
    webSearch: (args?: Parameters<typeof webSearchToolFactory>[0]) => _ai_sdk_provider_utils.ProviderExecutedTool<{}, {
        action?: {
            type: "search";
            query?: string;
            queries?: string[];
        } | {
            type: "openPage";
            url?: string | null;
        } | {
            type: "findInPage";
            url?: string | null;
            pattern?: string | null;
        };
        sources?: Array<{
            type: "url";
            url: string;
        } | {
            type: "api";
            name: string;
        }>;
    }, {}>;
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
    mcp: (args: {
        serverLabel: string;
        allowedTools?: string[] | {
            readOnly?: boolean;
            toolNames?: string[];
        };
        authorization?: string;
        connectorId?: string;
        headers?: Record<string, string>;
        requireApproval?: "always" | "never" | {
            never?: {
                toolNames?: string[];
            };
        };
        serverDescription?: string;
        serverUrl?: string;
    }) => _ai_sdk_provider_utils.ProviderExecutedTool<{}, {
        type: "call";
        serverLabel: string;
        name: string;
        arguments: string;
        output?: string | null;
        error?: _ai_sdk_provider.JSONValue;
    }, {}>;
    /**
     * Programmatic Tool Calling lets OpenAI Responses models write and execute
     * JavaScript that orchestrates eligible tools.
     */
    programmaticToolCalling: () => _ai_sdk_provider_utils.Experimental_ToolCallerTool<_ai_sdk_provider_utils.ProviderExecutedTool<{
        code: string;
        fingerprint: string;
    }, {
        result: string;
        status: "completed" | "incomplete";
    }, {}>>;
    /**
     * Tool search allows the model to dynamically search for and load deferred
     * tools into the model's context as needed. This helps reduce overall token
     * usage, cost, and latency by only loading tools when the model needs them.
     *
     * To use tool search, mark functions or namespaces with `defer_loading: true`
     * in the tools array. The model will use tool search to load these tools
     * when it determines they are needed.
     */
    toolSearch: (args?: Parameters<_ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        arguments?: unknown;
        call_id?: string | null;
    }, {
        tools: Array<_ai_sdk_provider.JSONObject>;
    }, {
        execution?: "server" | "client";
        description?: string;
        parameters?: Record<string, unknown>;
    }, {}>>[0]) => _ai_sdk_provider_utils.ProviderDefinedTool<{
        arguments?: unknown;
        call_id?: string | null;
    }, {
        tools: Array<_ai_sdk_provider.JSONObject>;
    }, {}>;
};

type OpenAISpeechTranslationModelId = 'gpt-realtime-translate' | (string & {});
declare const openAISpeechTranslationModelOptions: _ai_sdk_provider_utils.LazySchema<Record<string, never>>;
type OpenAISpeechTranslationModelOptions = InferSchema<typeof openAISpeechTranslationModelOptions>;

interface OpenAIProvider extends ProviderV4 {
    (modelId: OpenAIResponsesModelId): Experimental_BatchLanguageModelV4;
    /**
     * Creates an OpenAI model for text generation.
     */
    languageModel(modelId: OpenAIResponsesModelId): Experimental_BatchLanguageModelV4;
    /**
     * Creates an OpenAI chat model for text generation.
     */
    chat(modelId: OpenAIChatModelId): LanguageModelV4;
    /**
     * Creates an OpenAI responses API model for text generation.
     */
    responses(modelId: OpenAIResponsesModelId): Experimental_BatchLanguageModelV4;
    /**
     * Creates an OpenAI completion model for text generation.
     */
    completion(modelId: OpenAICompletionModelId): LanguageModelV4;
    /**
     * Creates a model for text embeddings.
     */
    embedding(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;
    /**
     * Creates a model for text embeddings.
     */
    embeddingModel(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;
    /**
     * @deprecated Use `embedding` instead.
     */
    textEmbedding(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;
    /**
     * @deprecated Use `embeddingModel` instead.
     */
    textEmbeddingModel(modelId: OpenAIEmbeddingModelId): EmbeddingModelV4;
    /**
     * Creates a model for image generation.
     */
    image(modelId: OpenAIImageModelId): ImageModelV4;
    /**
     * Creates a model for image generation.
     */
    imageModel(modelId: OpenAIImageModelId): ImageModelV4;
    /**
     * Creates a model for transcription.
     */
    transcription(modelId: OpenAITranscriptionModelId): TranscriptionModelV4;
    /**
     * Creates an experimental model for streaming speech translation.
     */
    translation(modelId: OpenAISpeechTranslationModelId): Experimental_SpeechTranslationModelV4;
    /**
     * Creates an experimental model for streaming speech translation.
     */
    speechTranslationModel(modelId: OpenAISpeechTranslationModelId): Experimental_SpeechTranslationModelV4;
    /**
     * Creates a model for speech generation.
     */
    speech(modelId: OpenAISpeechModelId): SpeechModelV4;
    /**
     * Creates an experimental realtime model for bidirectional audio/text
     * communication over WebSocket.
     */
    experimental_realtime: Experimental_RealtimeFactoryV4;
    /**
     * Returns a FilesV4 interface for uploading files to OpenAI.
     */
    files(): FilesV4;
    /**
     * Returns a SkillsV4 interface for uploading skills to OpenAI.
     */
    skills(): SkillsV4;
    /**
     * OpenAI-specific tools.
     */
    tools: typeof openaiTools;
}
interface OpenAIProviderSettings {
    /**
     * Base URL for the OpenAI API calls.
     */
    baseURL?: string;
    /**
     * API key for authenticating requests.
     */
    apiKey?: string;
    /**
     * OpenAI Organization.
     */
    organization?: string;
    /**
     * OpenAI project.
     */
    project?: string;
    /**
     * Custom headers to include in the requests.
     */
    headers?: Record<string, string>;
    /**
     * Provider name. Overrides the `openai` default name for 3rd party providers.
     */
    name?: string;
    /**
     * Custom fetch implementation. You can use it as a middleware to intercept requests,
     * or to provide a custom fetch implementation for e.g. testing.
     */
    fetch?: FetchFunction;
    /**
     * Custom WebSocket implementation. This is useful for testing or for
     * runtimes that need a WebSocket constructor with header support.
     */
    webSocket?: WebSocketConstructor;
}
/**
 * Create an OpenAI provider instance.
 */
declare function createOpenAI(options?: OpenAIProviderSettings): OpenAIProvider;
/**
 * Default OpenAI provider instance.
 */
declare const openai: OpenAIProvider;

type OpenAIRealtimeModelConfig = {
    provider: string;
    baseURL: string;
    headers: () => Record<string, string | undefined>;
    fetch?: FetchFunction;
};
declare class OpenAIRealtimeModel implements Experimental_RealtimeModelV4 {
    readonly specificationVersion: "v4";
    readonly provider: string;
    readonly modelId: string;
    private readonly config;
    constructor(modelId: string, config: OpenAIRealtimeModelConfig);
    doCreateClientSecret(options: Experimental_RealtimeModelV4ClientSecretOptions): Promise<Experimental_RealtimeModelV4ClientSecretResult>;
    getWebSocketConfig(options: {
        token: string;
        url: string;
    }): {
        url: string;
        protocols?: string[];
    };
    parseServerEvent(raw: unknown): Experimental_RealtimeModelV4ServerEvent;
    serializeClientEvent(event: Experimental_RealtimeModelV4ClientEvent): unknown;
    buildSessionConfig(config: Experimental_RealtimeModelV4SessionConfig): Record<string, unknown>;
}

type OpenAIToolOptions = {
    allowedCallers?: Array<'direct' | 'programmatic'>;
    deferLoading?: boolean;
    outputSchema?: JSONObject;
    namespace?: {
        name: string;
        description: string;
    };
};

interface OpenAISpeechTranslationModelConfig extends OpenAIConfig {
    _internal?: {
        currentDate?: () => Date;
    };
}
declare class OpenAISpeechTranslationModel implements Experimental_SpeechTranslationModelV4 {
    readonly modelId: OpenAISpeechTranslationModelId;
    private readonly config;
    readonly specificationVersion = "v4";
    static [WORKFLOW_SERIALIZE](model: OpenAISpeechTranslationModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAISpeechTranslationModelId;
        config: OpenAISpeechTranslationModelConfig;
    }): OpenAISpeechTranslationModel;
    get provider(): string;
    constructor(modelId: OpenAISpeechTranslationModelId, config: OpenAISpeechTranslationModelConfig);
    doStream(options: Experimental_SpeechTranslationModelV4StreamOptions): Promise<Awaited<ReturnType<Experimental_SpeechTranslationModelV4['doStream']>>>;
}

declare const openaiFilesOptionsSchema: _ai_sdk_provider_utils.LazySchema<{
    purpose?: string | undefined;
    expiresAfter?: number | undefined;
}>;
type OpenAIFilesOptions = InferSchema<typeof openaiFilesOptionsSchema>;

declare const safetyCheckSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const computerActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"click">;
    button: z.ZodEnum<{
        left: "left";
        right: "right";
        wheel: "wheel";
        back: "back";
        forward: "forward";
    }>;
    x: z.ZodNumber;
    y: z.ZodNumber;
    keys: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"double_click">;
    x: z.ZodNumber;
    y: z.ZodNumber;
    keys: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"drag">;
    path: z.ZodArray<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, z.core.$strip>>;
    keys: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"keypress">;
    keys: z.ZodArray<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"move">;
    x: z.ZodNumber;
    y: z.ZodNumber;
    keys: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"screenshot">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"scroll">;
    x: z.ZodNumber;
    y: z.ZodNumber;
    scrollX: z.ZodNumber;
    scrollY: z.ZodNumber;
    keys: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"type">;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"wait">;
}, z.core.$strip>]>;
type OpenAIComputerAction = z.infer<typeof computerActionSchema>;
type OpenAIComputerSafetyCheck = z.infer<typeof safetyCheckSchema>;

declare const VERSION: string;

export { OpenAIRealtimeModel as Experimental_OpenAIRealtimeModel, type OpenAIRealtimeModelConfig as Experimental_OpenAIRealtimeModelConfig, OpenAISpeechTranslationModel as Experimental_OpenAISpeechTranslationModel, type OpenAISpeechTranslationModelId as Experimental_OpenAISpeechTranslationModelId, type OpenAISpeechTranslationModelOptions as Experimental_OpenAISpeechTranslationModelOptions, OpenAISpeechTranslationModel as Experimental_OpenAITranslationModel, type OpenAISpeechTranslationModelId as Experimental_OpenAITranslationModelId, type OpenAISpeechTranslationModelOptions as Experimental_OpenAITranslationModelOptions, type OpenAIComputerAction, type OpenAIComputerSafetyCheck, type OpenAIFilesOptions, type OpenAIProvider, type OpenAIProviderSettings, type OpenAIToolOptions, VERSION, createOpenAI, openai };
