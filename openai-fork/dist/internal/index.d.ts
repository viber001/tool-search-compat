import * as _ai_sdk_provider from '@ai-sdk/provider';
import { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4GenerateResult, LanguageModelV4StreamResult, EmbeddingModelV4, ImageModelV4, TranscriptionModelV4CallOptions, TranscriptionModelV4, Experimental_TranscriptionModelV4StreamOptions, SpeechModelV4, SharedV4Warning, LanguageModelV4Prompt } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { WORKFLOW_SERIALIZE, WORKFLOW_DESERIALIZE, FetchFunction } from '@ai-sdk/provider-utils';
import { c as OpenAIChatModelId, d as OpenAICompletionModelId, e as OpenAIEmbeddingModelId, i as OpenAIConfig, f as OpenAIImageModelId, r as OpenAITranscriptionModelOptions, g as OpenAITranscriptionModelId, h as OpenAISpeechModelId, b as OpenAIResponsesModelId, y as OpenAIResponsesTool, z as OpenAIResponsesIncludeOptions, B as OpenAIResponsesInput, O as OpenAIResponsesFileSearchToolComparisonFilter, a as OpenAIResponsesFileSearchToolCompoundFilter } from '../openai-responses-provider-metadata-C1tCYWSW.js';
export { A as ApplyPatchOperation, k as OpenAIEmbeddingModelOptions, l as OpenAIImageModelEditOptions, m as OpenAIImageModelGenerationOptions, n as OpenAIImageModelOptions, j as OpenAILanguageModelChatOptions, o as OpenAILanguageModelCompletionOptions, q as OpenAISpeechModelOptions, s as OpenaiResponsesCompactionProviderMetadata, t as OpenaiResponsesProviderMetadata, u as OpenaiResponsesReasoningProviderMetadata, v as OpenaiResponsesSourceDocumentProviderMetadata, x as OpenaiResponsesTextProviderMetadata, R as ResponsesCompactionProviderMetadata, C as ResponsesProviderMetadata, D as ResponsesReasoningProviderMetadata, E as ResponsesSourceDocumentProviderMetadata, F as ResponsesTextProviderMetadata, G as applyPatch, H as applyPatchArgsSchema, I as applyPatchInputSchema, J as applyPatchOutputSchema, K as applyPatchToolFactory, L as getMaxImagesPerCall, M as hasDefaultResponseFormat, N as modelMaxImagesPerCall, P as openAITranscriptionModelOptions, Q as openaiEmbeddingModelOptions, S as openaiImageModelEditOptions, T as openaiImageModelGenerationOptions, U as openaiImageModelOptions, V as openaiLanguageModelChatOptions, W as openaiLanguageModelCompletionOptions, X as openaiSpeechModelOptionsSchema, Y as webSearch, Z as webSearchArgsSchema, _ as webSearchOutputSchema, w as webSearchToolFactory } from '../openai-responses-provider-metadata-C1tCYWSW.js';
import 'zod/v4';

type OpenAIChatConfig = {
    provider: string;
    headers?: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
};
declare class OpenAIChatLanguageModel implements LanguageModelV4 {
    readonly specificationVersion = "v4";
    readonly modelId: OpenAIChatModelId;
    readonly supportedUrls: {
        'image/*': RegExp[];
    };
    private readonly config;
    static [WORKFLOW_SERIALIZE](model: OpenAIChatLanguageModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAIChatModelId;
        config: OpenAIChatConfig;
    }): OpenAIChatLanguageModel;
    constructor(modelId: OpenAIChatModelId, config: OpenAIChatConfig);
    get provider(): string;
    private getArgs;
    doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult>;
    doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult>;
}

type OpenAICompletionConfig = {
    provider: string;
    headers?: () => Record<string, string | undefined>;
    url: (options: {
        modelId: string;
        path: string;
    }) => string;
    fetch?: FetchFunction;
};
declare class OpenAICompletionLanguageModel implements LanguageModelV4 {
    readonly specificationVersion = "v4";
    readonly modelId: OpenAICompletionModelId;
    private readonly config;
    private get providerOptionsName();
    static [WORKFLOW_SERIALIZE](model: OpenAICompletionLanguageModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAICompletionModelId;
        config: OpenAICompletionConfig;
    }): OpenAICompletionLanguageModel;
    constructor(modelId: OpenAICompletionModelId, config: OpenAICompletionConfig);
    get provider(): string;
    readonly supportedUrls: Record<string, RegExp[]>;
    private getArgs;
    doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult>;
    doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult>;
}

declare class OpenAIEmbeddingModel implements EmbeddingModelV4 {
    readonly specificationVersion = "v4";
    readonly modelId: OpenAIEmbeddingModelId;
    readonly maxEmbeddingsPerCall = 2048;
    readonly supportsParallelCalls = true;
    private readonly config;
    static [WORKFLOW_SERIALIZE](model: OpenAIEmbeddingModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAIEmbeddingModelId;
        config: OpenAIConfig;
    }): OpenAIEmbeddingModel;
    get provider(): string;
    constructor(modelId: OpenAIEmbeddingModelId, config: OpenAIConfig);
    doEmbed({ values, headers, abortSignal, providerOptions, }: Parameters<EmbeddingModelV4['doEmbed']>[0]): Promise<Awaited<ReturnType<EmbeddingModelV4['doEmbed']>>>;
}

interface OpenAIImageModelConfig extends OpenAIConfig {
    _internal?: {
        currentDate?: () => Date;
    };
}
declare class OpenAIImageModel implements ImageModelV4 {
    readonly modelId: OpenAIImageModelId;
    private readonly config;
    readonly specificationVersion = "v4";
    static [WORKFLOW_SERIALIZE](model: OpenAIImageModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAIImageModelId;
        config: OpenAIImageModelConfig;
    }): OpenAIImageModel;
    get maxImagesPerCall(): number;
    get provider(): string;
    constructor(modelId: OpenAIImageModelId, config: OpenAIImageModelConfig);
    doGenerate({ prompt, files, mask, n, size, aspectRatio, seed, providerOptions, headers, abortSignal, }: Parameters<ImageModelV4['doGenerate']>[0]): Promise<Awaited<ReturnType<ImageModelV4['doGenerate']>>>;
}

type OpenAITranscriptionCallOptions = Omit<TranscriptionModelV4CallOptions, 'providerOptions'> & {
    providerOptions?: {
        openai?: OpenAITranscriptionModelOptions;
    };
};
type OpenAITranscriptionStreamOptions = Omit<Experimental_TranscriptionModelV4StreamOptions, 'providerOptions'> & {
    providerOptions?: {
        openai?: OpenAITranscriptionModelOptions;
    };
};
interface OpenAITranscriptionModelConfig extends OpenAIConfig {
    _internal?: {
        currentDate?: () => Date;
    };
}
declare class OpenAITranscriptionModel implements TranscriptionModelV4 {
    readonly modelId: OpenAITranscriptionModelId;
    private readonly config;
    readonly specificationVersion = "v4";
    static [WORKFLOW_SERIALIZE](model: OpenAITranscriptionModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAITranscriptionModelId;
        config: OpenAITranscriptionModelConfig;
    }): OpenAITranscriptionModel;
    get provider(): string;
    constructor(modelId: OpenAITranscriptionModelId, config: OpenAITranscriptionModelConfig);
    private getArgs;
    doGenerate(options: OpenAITranscriptionCallOptions): Promise<Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>>;
    doStream(options: OpenAITranscriptionStreamOptions): Promise<Awaited<ReturnType<NonNullable<TranscriptionModelV4['doStream']>>>>;
}

interface OpenAISpeechModelConfig extends OpenAIConfig {
    _internal?: {
        currentDate?: () => Date;
    };
}
declare class OpenAISpeechModel implements SpeechModelV4 {
    readonly modelId: OpenAISpeechModelId;
    private readonly config;
    readonly specificationVersion = "v4";
    static [WORKFLOW_SERIALIZE](model: OpenAISpeechModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAISpeechModelId;
        config: OpenAISpeechModelConfig;
    }): OpenAISpeechModel;
    get provider(): string;
    constructor(modelId: OpenAISpeechModelId, config: OpenAISpeechModelConfig);
    private getArgs;
    doGenerate(options: Parameters<SpeechModelV4['doGenerate']>[0]): Promise<Awaited<ReturnType<SpeechModelV4['doGenerate']>>>;
}

declare class OpenAIResponsesLanguageModel implements LanguageModelV4 {
    readonly specificationVersion = "v4";
    readonly modelId: OpenAIResponsesModelId;
    private readonly config;
    static [WORKFLOW_SERIALIZE](model: OpenAIResponsesLanguageModel): {
        modelId: string;
        config: _ai_sdk_provider.JSONObject;
    };
    static [WORKFLOW_DESERIALIZE](options: {
        modelId: OpenAIResponsesModelId;
        config: OpenAIConfig;
    }): OpenAIResponsesLanguageModel;
    constructor(modelId: OpenAIResponsesModelId, config: OpenAIConfig);
    readonly supportedUrls: Record<string, RegExp[]>;
    get provider(): string;
    protected getArgs({ maxOutputTokens, temperature, stopSequences, topP, topK, presencePenalty, frequencyPenalty, seed, prompt, reasoning, providerOptions, tools, toolChoice, responseFormat, }: LanguageModelV4CallOptions): Promise<{
        webSearchToolName: string | undefined;
        args: {
            tools: OpenAIResponsesTool[] | undefined;
            tool_choice: "auto" | "none" | "required" | {
                type: "file_search";
            } | {
                type: "web_search_preview";
            } | {
                type: "web_search";
            } | {
                type: "function";
                name: string;
            } | {
                type: "custom";
                name: string;
            } | {
                type: "code_interpreter";
            } | {
                type: "mcp";
            } | {
                type: "image_generation";
            } | {
                type: "apply_patch";
            } | {
                type: "computer";
            } | {
                type: "programmatic_tool_calling";
            } | {
                type: "allowed_tools";
                mode: "auto" | "required";
                tools: Array<{
                    type: "function";
                    name: string;
                }>;
            } | undefined;
            reasoning?: {
                context?: "auto" | "current_turn" | "all_turns" | undefined;
                mode?: "standard" | "pro" | undefined;
                summary?: string | undefined;
                effort?: string | undefined;
            } | undefined;
            context_management?: {
                type: "compaction";
                compact_threshold: number;
            }[] | undefined;
            conversation: string | null | undefined;
            max_tool_calls: number | null | undefined;
            metadata: any;
            parallel_tool_calls: boolean | null | undefined;
            previous_response_id: string | null | undefined;
            store: boolean;
            user: string | null | undefined;
            instructions: string | null | undefined;
            service_tier: "default" | "auto" | "flex" | "priority" | "fast" | null | undefined;
            include: OpenAIResponsesIncludeOptions;
            prompt_cache_key: string | null | undefined;
            prompt_cache_options: {
                mode?: "explicit" | "implicit" | undefined;
                ttl?: "30m" | undefined;
            } | undefined;
            prompt_cache_retention: "in_memory" | "24h" | null | undefined;
            safety_identifier: string | null | undefined;
            top_logprobs: number | undefined;
            truncation: "auto" | "disabled" | null | undefined;
            text?: {
                verbosity?: "low" | "medium" | "high" | undefined;
                format?: {
                    type: string;
                    strict: boolean;
                    name: string;
                    description: string | undefined;
                    schema: any;
                } | {
                    type: string;
                    strict?: undefined;
                    name?: undefined;
                    description?: undefined;
                    schema?: undefined;
                } | undefined;
            } | undefined;
            model: OpenAIResponsesModelId;
            input: OpenAIResponsesInput;
            temperature: number | undefined;
            top_p: number | undefined;
            max_output_tokens: number | undefined;
        };
        warnings: SharedV4Warning[];
        store: boolean;
        toolNameMapping: _ai_sdk_provider_utils.ToolNameMapping;
        providerOptionsName: string;
        isShellProviderExecuted: boolean;
        convertPromptToInput: (prompt: LanguageModelV4Prompt) => Promise<{
            input: OpenAIResponsesInput;
            warnings: Array<SharedV4Warning>;
        }>;
    }>;
    doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult>;
    doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult>;
}

declare const codeInterpreterInputSchema: _ai_sdk_provider_utils.LazySchema<{
    containerId: string;
    code?: string | null | undefined;
}>;
declare const codeInterpreterOutputSchema: _ai_sdk_provider_utils.LazySchema<{
    outputs?: ({
        type: "logs";
        logs: string;
    } | {
        type: "image";
        url: string;
    })[] | null | undefined;
}>;
declare const codeInterpreterArgsSchema: _ai_sdk_provider_utils.LazySchema<{
    container?: string | {
        fileIds?: string[] | undefined;
    } | undefined;
}>;
type CodeInterpreterArgs = {
    /**
     * The code interpreter container.
     * Can be a container ID
     * or an object that specifies uploaded file IDs to make available to your code.
     */
    container?: string | {
        fileIds?: string[];
    };
};
declare const codeInterpreterToolFactory: _ai_sdk_provider_utils.ProviderExecutedToolFactory<{
    /**
     * The code to run, or null if not available.
     */
    code?: string | null;
    /**
     * The ID of the container used to run the code.
     */
    containerId: string;
}, {
    /**
     * The outputs generated by the code interpreter, such as logs or images.
     * Can be null if no outputs are available.
     */
    outputs?: Array<{
        type: "logs";
        /**
         * The logs output from the code interpreter.
         */
        logs: string;
    } | {
        type: "image";
        /**
         * The URL of the image output from the code interpreter.
         */
        url: string;
    }> | null;
}, CodeInterpreterArgs, {}>;
declare const codeInterpreter: (args?: CodeInterpreterArgs) => _ai_sdk_provider_utils.ProviderExecutedTool<{
    /**
     * The code to run, or null if not available.
     */
    code?: string | null;
    /**
     * The ID of the container used to run the code.
     */
    containerId: string;
}, {
    /**
     * The outputs generated by the code interpreter, such as logs or images.
     * Can be null if no outputs are available.
     */
    outputs?: Array<{
        type: "logs";
        /**
         * The logs output from the code interpreter.
         */
        logs: string;
    } | {
        type: "image";
        /**
         * The URL of the image output from the code interpreter.
         */
        url: string;
    }> | null;
}, {}>;

declare const fileSearchArgsSchema: _ai_sdk_provider_utils.LazySchema<{
    vectorStoreIds: string[];
    maxNumResults?: number | undefined;
    ranking?: {
        ranker?: string | undefined;
        scoreThreshold?: number | undefined;
    } | undefined;
    filters?: any;
}>;
declare const fileSearchOutputSchema: _ai_sdk_provider_utils.LazySchema<{
    queries: string[];
    results: {
        attributes: Record<string, unknown>;
        fileId: string;
        filename: string;
        score: number;
        text: string;
    }[] | null;
}>;
declare const fileSearch: _ai_sdk_provider_utils.ProviderExecutedToolFactory<{}, {
    /**
     * The search query to execute.
     */
    queries: string[];
    /**
     * The results of the file search tool call.
     */
    results: null | {
        /**
         * Set of 16 key-value pairs that can be attached to an object.
         * This can be useful for storing additional information about the object
         * in a structured format, and querying for objects via API or the dashboard.
         * Keys are strings with a maximum length of 64 characters.
         * Values are strings with a maximum length of 512 characters, booleans, or numbers.
         */
        attributes: Record<string, unknown>;
        /**
         * The unique ID of the file.
         */
        fileId: string;
        /**
         * The name of the file.
         */
        filename: string;
        /**
         * The relevance score of the file - a value between 0 and 1.
         */
        score: number;
        /**
         * The text that was retrieved from the file.
         */
        text: string;
    }[];
}, {
    /**
     * List of vector store IDs to search through.
     */
    vectorStoreIds: string[];
    /**
     * Maximum number of search results to return. Defaults to 10.
     */
    maxNumResults?: number;
    /**
     * Ranking options for the search.
     */
    ranking?: {
        /**
         * The ranker to use for the file search.
         */
        ranker?: string;
        /**
         * The score threshold for the file search, a number between 0 and 1.
         * Numbers closer to 1 will attempt to return only the most relevant results,
         * but may return fewer results.
         */
        scoreThreshold?: number;
    };
    /**
     * A filter to apply.
     */
    filters?: OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter;
}, {}>;

declare const imageGenerationArgsSchema: _ai_sdk_provider_utils.LazySchema<{
    background?: "auto" | "transparent" | "opaque" | undefined;
    inputFidelity?: "low" | "high" | undefined;
    inputImageMask?: {
        fileId?: string | undefined;
        imageUrl?: string | undefined;
    } | undefined;
    model?: string | undefined;
    moderation?: "auto" | undefined;
    outputCompression?: number | undefined;
    outputFormat?: "png" | "jpeg" | "webp" | undefined;
    partialImages?: number | undefined;
    quality?: "auto" | "low" | "medium" | "high" | undefined;
    size?: "auto" | "1024x1024" | "1024x1536" | "1536x1024" | undefined;
}>;
declare const imageGenerationOutputSchema: _ai_sdk_provider_utils.LazySchema<{
    result: string;
}>;
type ImageGenerationArgs = {
    /**
     * Background type for the generated image. Default is 'auto'.
     */
    background?: 'auto' | 'opaque' | 'transparent';
    /**
     * Input fidelity for the generated image. Default is 'low'.
     */
    inputFidelity?: 'low' | 'high';
    /**
     * Optional mask for inpainting.
     * Contains image_url (string, optional) and file_id (string, optional).
     */
    inputImageMask?: {
        /**
         * File ID for the mask image.
         */
        fileId?: string;
        /**
         * Base64-encoded mask image.
         */
        imageUrl?: string;
    };
    /**
     * The image generation model to use. Default: gpt-image-1.
     */
    model?: string;
    /**
     * Moderation level for the generated image. Default: auto.
     */
    moderation?: 'auto';
    /**
     * Compression level for the output image. Default: 100.
     */
    outputCompression?: number;
    /**
     * The output format of the generated image. One of png, webp, or jpeg.
     * Default: png
     */
    outputFormat?: 'png' | 'jpeg' | 'webp';
    /**
     * Number of partial images to generate in streaming mode, from 0 (default value) to 3.
     */
    partialImages?: number;
    /**
     * The quality of the generated image.
     * One of low, medium, high, or auto. Default: auto.
     */
    quality?: 'auto' | 'low' | 'medium' | 'high';
    /**
     * The size of the generated image.
     * One of 1024x1024, 1024x1536, 1536x1024, or auto.
     * Default: auto.
     */
    size?: 'auto' | '1024x1024' | '1024x1536' | '1536x1024';
};
declare const imageGeneration: (args?: ImageGenerationArgs) => _ai_sdk_provider_utils.ProviderExecutedTool<{}, {
    /**
     * The generated image encoded in base64.
     */
    result: string;
}, {}>;

declare const programmaticToolCallingInputSchema: _ai_sdk_provider_utils.LazySchema<{
    code: string;
    fingerprint: string;
}>;
declare const programmaticToolCallingOutputSchema: _ai_sdk_provider_utils.LazySchema<{
    result: string;
    status: "completed" | "incomplete";
}>;
declare const programmaticToolCalling: () => _ai_sdk_provider_utils.Experimental_ToolCallerTool<_ai_sdk_provider_utils.ProviderExecutedTool<{
    /**
     * JavaScript source generated and executed by OpenAI.
     */
    code: string;
    /**
     * Opaque replay fingerprint that must be preserved across requests.
     */
    fingerprint: string;
}, {
    /**
     * The result emitted by the hosted JavaScript program.
     */
    result: string;
    /**
     * Whether the program completed or stopped before producing a final result.
     */
    status: "completed" | "incomplete";
}, {}>>;

declare const webSearchPreviewArgsSchema: _ai_sdk_provider_utils.LazySchema<{
    searchContextSize?: "low" | "medium" | "high" | undefined;
    userLocation?: {
        type: "approximate";
        country?: string | undefined;
        city?: string | undefined;
        region?: string | undefined;
        timezone?: string | undefined;
    } | undefined;
}>;
declare const webSearchPreviewInputSchema: _ai_sdk_provider_utils.LazySchema<Record<string, never>>;
declare const webSearchPreview: _ai_sdk_provider_utils.ProviderExecutedToolFactory<{}, {
    /**
     * An object describing the specific action taken in this web search call.
     * Includes details on how the model used the web (search, open_page, find_in_page).
     */
    action?: {
        /**
         * Action type "search" - Performs a web search query.
         */
        type: "search";
        /**
         * The search query.
         */
        query?: string;
    } | {
        /**
         * Action type "openPage" - Opens a specific URL from search results.
         */
        type: "openPage";
        /**
         * The URL opened by the model.
         */
        url?: string | null;
    } | {
        /**
         * Action type "findInPage": Searches for a pattern within a loaded page.
         */
        type: "findInPage";
        /**
         * The URL of the page searched for the pattern.
         */
        url?: string | null;
        /**
         * The pattern or text to search for within the page.
         */
        pattern?: string | null;
    };
}, {
    /**
     * Search context size to use for the web search.
     * - high: Most comprehensive context, highest cost, slower response
     * - medium: Balanced context, cost, and latency (default)
     * - low: Least context, lowest cost, fastest response
     */
    searchContextSize?: "low" | "medium" | "high";
    /**
     * User location information to provide geographically relevant search results.
     */
    userLocation?: {
        /**
         * Type of location (always 'approximate')
         */
        type: "approximate";
        /**
         * Two-letter ISO country code (e.g., 'US', 'GB')
         */
        country?: string;
        /**
         * City name (free text, e.g., 'Minneapolis')
         */
        city?: string;
        /**
         * Region name (free text, e.g., 'Minnesota')
         */
        region?: string;
        /**
         * IANA timezone (e.g., 'America/Chicago')
         */
        timezone?: string;
    };
}, {}>;

export { OpenAIChatLanguageModel, OpenAIChatModelId, OpenAICompletionLanguageModel, OpenAICompletionModelId, OpenAIEmbeddingModel, OpenAIEmbeddingModelId, OpenAIImageModel, OpenAIImageModelId, OpenAIResponsesLanguageModel, OpenAISpeechModel, OpenAISpeechModelId, type OpenAITranscriptionCallOptions, OpenAITranscriptionModel, OpenAITranscriptionModelId, OpenAITranscriptionModelOptions, type OpenAITranscriptionStreamOptions, codeInterpreter, codeInterpreterArgsSchema, codeInterpreterInputSchema, codeInterpreterOutputSchema, codeInterpreterToolFactory, fileSearch, fileSearchArgsSchema, fileSearchOutputSchema, imageGeneration, imageGenerationArgsSchema, imageGenerationOutputSchema, programmaticToolCalling, programmaticToolCallingInputSchema, programmaticToolCallingOutputSchema, webSearchPreview, webSearchPreviewArgsSchema, webSearchPreviewInputSchema };
