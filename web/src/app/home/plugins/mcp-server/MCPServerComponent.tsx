'use client';

import { useEffect, useState } from 'react';
import styles from '@/app/home/plugins/plugins.module.css';
import MCPCardComponent from '@/app/home/plugins/mcp/mcp-card/MCPCardComponent';
import { MCPCardVO } from '@/app/home/plugins/mcp/MCPCardVO';
import { useTranslation } from 'react-i18next';

import { httpClient } from '@/app/infra/http/HttpClient';

export default function MCPMarketComponent({
  onEditServer,
  toolsCountCache = {},
}: {
  askInstallServer?: (githubURL: string) => void;
  onEditServer?: (serverName: string) => void;
  toolsCountCache?: Record<string, number>;
}) {
  const { t } = useTranslation();
  const [installedServers, setInstalledServers] = useState<MCPCardVO[]>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    fetchInstalledServers();
  }, [toolsCountCache]);

  function initData() {
    fetchInstalledServers();
  }

  function fetchInstalledServers() {
    setLoading(true);
    httpClient
      .getMCPServers()
      .then((resp) => {
        const servers = resp.servers.map((server) => {
          const vo = new MCPCardVO(server);
          
          if (toolsCountCache[server.name] !== undefined) {
            vo.tools = toolsCountCache[server.name];
          }
          return vo;
        });
        setInstalledServers(servers);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch MCP servers:', error);
        setLoading(false);
      });
  }

  

  return (
    <div className={`${styles.marketComponentBody}`}>
      {/* 已安装的服务器列表 */}
      <div className="mb-6">
        <div className={`${styles.pluginListContainer}`}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              {t('mcp.loading')}
            </div>
          ) : installedServers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              {t('mcp.noServerInstalled')}
            </div>
          ) : (
            installedServers.map((server, index) => (
              <div key={`${server.name}-${index}`}>
                <MCPCardComponent
                  cardVO={server}
                  onCardClick={() => {
                    if (onEditServer) {
                      onEditServer(server.name);
                    }
                  }}
                  onRefresh={fetchInstalledServers}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
