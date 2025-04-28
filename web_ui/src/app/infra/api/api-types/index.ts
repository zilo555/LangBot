export interface ApiResponse<T> {
    code: number;
    data: T;
    msg: string;
}

export interface I18nText {
    en_US: string;
    zh_CN: string;
}

export interface AsyncTaskCreatedResp {
    task_id: number;
}

export interface ApiRespProviderRequesters {
    requesters: Requester[];
}

export interface ApiRespProviderRequester {
    requester: Requester;
}

export interface Requester {
    name: string;
    label: I18nText;
    description: I18nText;
    icon?: string;
    spec: object;
}

export interface ApiRespProviderLLMModels {
    models: LLMModel[];
}

export interface ApiRespProviderLLMModel {
    model: LLMModel;
}

export interface LLMModel {
    name: string;
    description: string;
    uuid: string;
    requester: string;
    requester_config: object;
    extra_args: object;
    api_keys: string[];
    abilities: string[];
    // created_at: string;
    // updated_at: string;
}

export interface ApiRespPipelines {
    pipelines: Pipeline[];
}

export interface ApiRespPipeline {
    pipeline: Pipeline;
}

export interface Pipeline {
    uuid: string;
    name: string;
    description: string;
    for_version: string;
    config: object;
    stages: string[];
    created_at: string;
    updated_at: string;
}

export interface ApiRespPlatformAdapters {
    adapters: Adapter[];
}

export interface ApiRespPlatformAdapter {
    adapter: Adapter;
}

export interface Adapter {
    name: string;
    label: I18nText;
    description: I18nText;
    icon?: string;
    spec: object;
}

export interface ApiRespPlatformBots {
    bots: Bot[];
}

export interface ApiRespPlatformBot {
    bot: Bot;
}

export interface Bot {
    uuid?: string;
    name: string;
    description: string;
    enable?: boolean;
    adapter: string;
    adapter_config: object;
    use_pipeline_name?: string;
    use_pipeline_uuid?: string;
    created_at?: string;
    updated_at?: string;
}

// plugins
export interface ApiRespPlugins {
    plugins: Plugin[];
}

export interface ApiRespPlugin {
    plugin: Plugin;
}

export interface Plugin {
    author: string;
    name: string;
    description: I18nText;
    label: I18nText;
    version: string;
    enabled: boolean;
    priority: number;
    status: string;
    tools: object[];
    event_handlers: object;
    main_file: string;
    pkg_path: string;
    repository: string;
    config_schema: object;
}

export interface ApiRespPluginConfig {
    config: object;
}

export interface PluginReorderElement {
    author: string;
    name: string;
    priority: number;
}

// system
export interface ApiRespSystemInfo {
    debug: boolean;
    version: string;
}

export interface ApiRespAsyncTasks {
    tasks: AsyncTask[];
}

export interface ApiRespAsyncTask {
    task: AsyncTask;
}

export interface AsyncTaskRuntimeInfo {
    done: boolean;
    exception?: string;
    result?: object;
    state: string;
}

export interface AsyncTaskTaskContext {
    current_action: string;
    log: string;
}

export interface AsyncTask {
    id: number;
    kind: string;
    name: string;
    task_type: string;  // system or user
    runtime: AsyncTaskRuntimeInfo;
    task_context: AsyncTaskTaskContext;
}

export interface ApiRespUserToken {
    token: string;
}

export interface MarketPlugin {
    ID: number
    CreatedAt: string // ISO 8601 格式日期
    UpdatedAt: string
    DeletedAt: string | null
    name: string
    author: string
    description: string
    repository: string // GitHub 仓库路径
    artifacts_path: string
    stars: number
    downloads: number
    status: "initialized" | "mounted" // 可根据实际状态值扩展联合类型
    synced_at: string
    pushed_at: string // 最后一次代码推送时间
}

export interface MarketPluginResponse {
    plugins: MarketPlugin[]
    total: number
}
