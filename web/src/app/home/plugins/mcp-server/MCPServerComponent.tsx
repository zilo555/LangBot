'use client';

import { useEffect, useState, useRef } from 'react';
import MCPCardComponent from '@/app/home/plugins/mcp-server/mcp-card/MCPCardComponent';
import { MCPCardVO } from '@/app/home/plugins/mcp-server/MCPCardVO';
import { useTranslation } from 'react-i18next';
import { MCPSessionStatus } from '@/app/infra/entities/api';

import { httpClient } from '@/app/infra/http/HttpClient';

export default function MCPComponent({
  onEditServer,
}: {
  askInstallServer?: (githubURL: string) => void;
  onEditServer?: (serverName: string) => void;
}) {
  const { t } = useTranslation();
  const [installedServers, setInstalledServers] = useState<MCPCardVO[]>([]);
  const [loading, setLoading] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInstalledServers();

    return () => {
      // Cleanup: clear polling interval when component unmounts
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Check if any server is connecting and start/stop polling accordingly
  useEffect(() => {
    const hasConnecting = installedServers.some(
      (server) => server.status === MCPSessionStatus.CONNECTING,
    );

    if (hasConnecting && !pollingIntervalRef.current) {
      // Start polling every 3 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchInstalledServers();
      }, 3000);
    } else if (!hasConnecting && pollingIntervalRef.current) {
      // Stop polling when no server is connecting
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [installedServers]);

  function fetchInstalledServers() {
    setLoading(true);
    httpClient
      .getMCPServers()
      .then((resp) => {
        const servers = resp.servers.map((server) => new MCPCardVO(server));
        setInstalledServers(servers);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch MCP servers:', error);
        setLoading(false);
      });
  }

  return (
    <div className="w-full h-full">
      {/* 已安装的服务器列表 */}
      <div className="mb-[2rem]">
        <div className="w-full px-[0.8rem] pt-[2rem] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="text-center p-[2rem]">{t('mcp.loading')}</div>
          ) : installedServers.length === 0 ? (
            <div className="text-center p-[2rem]">
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
