import { BaseHttpClient } from './BaseHttpClient';
import { MarketPluginResponse } from '@/app/infra/entities/api';

/**
 * 云服务客户端
 * 负责与 cloud service 的所有交互
 */
export class CloudServiceClient extends BaseHttpClient {
  constructor(baseURL: string = '') {
    // cloud service 不需要 token 认证
    super(baseURL, true);
  }

  /**
   * 获取插件市场插件列表
   * @param page 页码
   * @param page_size 每页大小
   * @param query 搜索关键词
   * @param sort_by 排序字段
   * @param sort_order 排序顺序
   */
  public getMarketPlugins(
    page: number,
    page_size: number,
    query: string,
    sort_by: string = 'stars',
    sort_order: string = 'DESC',
  ): Promise<MarketPluginResponse> {
    return this.post(`/api/v1/market/plugins`, {
      page,
      page_size,
      query,
      sort_by,
      sort_order,
    });
  }

  // 未来可以在这里添加更多 cloud service 相关的方法
}
