import { BaseHttpClient } from './BaseHttpClient';
import {
  ApiRespProviderRequesters,
  ApiRespProviderRequester,
  ApiRespProviderLLMModels,
  ApiRespProviderLLMModel,
  LLMModel,
  ApiRespPipelines,
  Pipeline,
  ApiRespPlatformAdapters,
  ApiRespPlatformAdapter,
  ApiRespPlatformBots,
  ApiRespPlatformBot,
  Bot,
  ApiRespPlugins,
  ApiRespPlugin,
  ApiRespPluginConfig,
  AsyncTaskCreatedResp,
  ApiRespSystemInfo,
  ApiRespAsyncTasks,
  ApiRespUserToken,
  GetPipelineResponseData,
  GetPipelineMetadataResponseData,
  AsyncTask,
  ApiRespWebChatMessage,
  ApiRespWebChatMessages,
} from '@/app/infra/entities/api';
import { GetBotLogsRequest } from '@/app/infra/http/requestParam/bots/GetBotLogsRequest';
import { GetBotLogsResponse } from '@/app/infra/http/requestParam/bots/GetBotLogsResponse';

/**
 * 后端服务客户端
 * 负责与后端 API 的所有交互
 */
export class BackendClient extends BaseHttpClient {
  constructor(baseURL: string) {
    super(baseURL, false);
  }

  // ============ Provider API ============
  public getProviderRequesters(): Promise<ApiRespProviderRequesters> {
    return this.get('/api/v1/provider/requesters');
  }

  public getProviderRequester(name: string): Promise<ApiRespProviderRequester> {
    return this.get(`/api/v1/provider/requesters/${name}`);
  }

  public getProviderRequesterIconURL(name: string): string {
    if (this.instance.defaults.baseURL === '/') {
      // 获取用户访问的URL
      const url = window.location.href;
      const baseURL = url.split('/').slice(0, 3).join('/');
      return `${baseURL}/api/v1/provider/requesters/${name}/icon`;
    }
    return (
      this.instance.defaults.baseURL +
      `/api/v1/provider/requesters/${name}/icon`
    );
  }

  // ============ Provider Model LLM ============
  public getProviderLLMModels(): Promise<ApiRespProviderLLMModels> {
    return this.get('/api/v1/provider/models/llm');
  }

  public getProviderLLMModel(uuid: string): Promise<ApiRespProviderLLMModel> {
    return this.get(`/api/v1/provider/models/llm/${uuid}`);
  }

  public createProviderLLMModel(model: LLMModel): Promise<object> {
    return this.post('/api/v1/provider/models/llm', model);
  }

  public deleteProviderLLMModel(uuid: string): Promise<object> {
    return this.delete(`/api/v1/provider/models/llm/${uuid}`);
  }

  public updateProviderLLMModel(
    uuid: string,
    model: LLMModel,
  ): Promise<object> {
    return this.put(`/api/v1/provider/models/llm/${uuid}`, model);
  }

  public testLLMModel(uuid: string, model: LLMModel): Promise<object> {
    return this.post(`/api/v1/provider/models/llm/${uuid}/test`, model);
  }

  // ============ Pipeline API ============
  public getGeneralPipelineMetadata(): Promise<GetPipelineMetadataResponseData> {
    // as designed, this method will be deprecated, and only for developer to check the prefered config schema
    return this.get('/api/v1/pipelines/_/metadata');
  }

  public getPipelines(): Promise<ApiRespPipelines> {
    return this.get('/api/v1/pipelines');
  }

  public getPipeline(uuid: string): Promise<GetPipelineResponseData> {
    return this.get(`/api/v1/pipelines/${uuid}`);
  }

  public createPipeline(pipeline: Pipeline): Promise<{
    uuid: string;
  }> {
    return this.post('/api/v1/pipelines', pipeline);
  }

  public updatePipeline(uuid: string, pipeline: Pipeline): Promise<object> {
    return this.put(`/api/v1/pipelines/${uuid}`, pipeline);
  }

  public deletePipeline(uuid: string): Promise<object> {
    return this.delete(`/api/v1/pipelines/${uuid}`);
  }

  // ============ Debug WebChat API ============
  public sendWebChatMessage(
    sessionType: string,
    messageChain: object[],
    pipelineId: string,
    timeout: number = 15000,
  ): Promise<ApiRespWebChatMessage> {
    return this.post(
      `/api/v1/pipelines/${pipelineId}/chat/send`,
      {
        session_type: sessionType,
        message: messageChain,
      },
      {
        timeout,
      },
    );
  }

  public getWebChatHistoryMessages(
    pipelineId: string,
    sessionType: string,
  ): Promise<ApiRespWebChatMessages> {
    return this.get(
      `/api/v1/pipelines/${pipelineId}/chat/messages/${sessionType}`,
    );
  }

  public resetWebChatSession(
    pipelineId: string,
    sessionType: string,
  ): Promise<{ message: string }> {
    return this.post(
      `/api/v1/pipelines/${pipelineId}/chat/reset/${sessionType}`,
    );
  }

  // ============ Platform API ============
  public getAdapters(): Promise<ApiRespPlatformAdapters> {
    return this.get('/api/v1/platform/adapters');
  }

  public getAdapter(name: string): Promise<ApiRespPlatformAdapter> {
    return this.get(`/api/v1/platform/adapters/${name}`);
  }

  public getAdapterIconURL(name: string): string {
    if (this.instance.defaults.baseURL === '/') {
      // 获取用户访问的URL
      const url = window.location.href;
      const baseURL = url.split('/').slice(0, 3).join('/');
      return `${baseURL}/api/v1/platform/adapters/${name}/icon`;
    }
    return (
      this.instance.defaults.baseURL + `/api/v1/platform/adapters/${name}/icon`
    );
  }

  // ============ Platform Bots ============
  public getBots(): Promise<ApiRespPlatformBots> {
    return this.get('/api/v1/platform/bots');
  }

  public getBot(uuid: string): Promise<ApiRespPlatformBot> {
    return this.get(`/api/v1/platform/bots/${uuid}`);
  }

  public createBot(bot: Bot): Promise<{ uuid: string }> {
    return this.post('/api/v1/platform/bots', bot);
  }

  public updateBot(uuid: string, bot: Bot): Promise<object> {
    return this.put(`/api/v1/platform/bots/${uuid}`, bot);
  }

  public deleteBot(uuid: string): Promise<object> {
    return this.delete(`/api/v1/platform/bots/${uuid}`);
  }

  public getBotLogs(
    botId: string,
    request: GetBotLogsRequest,
  ): Promise<GetBotLogsResponse> {
    return this.post(`/api/v1/platform/bots/${botId}/logs`, request);
  }

  // ============ Plugins API ============
  public getPlugins(): Promise<ApiRespPlugins> {
    return this.get('/api/v1/plugins');
  }

  public getPlugin(author: string, name: string): Promise<ApiRespPlugin> {
    return this.get(`/api/v1/plugins/${author}/${name}`);
  }

  public getPluginConfig(
    author: string,
    name: string,
  ): Promise<ApiRespPluginConfig> {
    return this.get(`/api/v1/plugins/${author}/${name}/config`);
  }

  public updatePluginConfig(
    author: string,
    name: string,
    config: object,
  ): Promise<object> {
    return this.put(`/api/v1/plugins/${author}/${name}/config`, config);
  }

  public installPluginFromGithub(
    source: string,
  ): Promise<AsyncTaskCreatedResp> {
    return this.post('/api/v1/plugins/install/github', { source });
  }

  public installPluginFromLocal(file: File): Promise<AsyncTaskCreatedResp> {
    const formData = new FormData();
    formData.append('file', file);
    return this.postFile('/api/v1/plugins/install/local', formData);
  }

  public installPluginFromMarketplace(
    author: string,
    name: string,
    version: string,
  ): Promise<AsyncTaskCreatedResp> {
    return this.post('/api/v1/plugins/install/marketplace', {
      plugin_author: author,
      plugin_name: name,
      plugin_version: version,
    });
  }

  public removePlugin(
    author: string,
    name: string,
  ): Promise<AsyncTaskCreatedResp> {
    return this.delete(`/api/v1/plugins/${author}/${name}`);
  }

  public upgradePlugin(
    author: string,
    name: string,
  ): Promise<AsyncTaskCreatedResp> {
    return this.post(`/api/v1/plugins/${author}/${name}/upgrade`);
  }

  // ============ System API ============
  public getSystemInfo(): Promise<ApiRespSystemInfo> {
    return this.get('/api/v1/system/info');
  }

  public getAsyncTasks(): Promise<ApiRespAsyncTasks> {
    return this.get('/api/v1/system/tasks');
  }

  public getAsyncTask(id: number): Promise<AsyncTask> {
    return this.get(`/api/v1/system/tasks/${id}`);
  }

  // ============ User API ============
  public checkIfInited(): Promise<{ initialized: boolean }> {
    return this.get('/api/v1/user/init');
  }

  public initUser(user: string, password: string): Promise<object> {
    return this.post('/api/v1/user/init', { user, password });
  }

  public authUser(user: string, password: string): Promise<ApiRespUserToken> {
    return this.post('/api/v1/user/auth', { user, password });
  }

  public checkUserToken(): Promise<ApiRespUserToken> {
    return this.get('/api/v1/user/check-token');
  }
}
