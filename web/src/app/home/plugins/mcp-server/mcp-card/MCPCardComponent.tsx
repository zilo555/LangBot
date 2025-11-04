import { MCPCardVO } from '@/app/home/plugins/mcp-server/MCPCardVO';
import { useState, useEffect } from 'react';
import { httpClient } from '@/app/infra/http/HttpClient';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, Wrench } from 'lucide-react';

export default function MCPCardComponent({
  cardVO,
  onCardClick,
  onRefresh,
}: {
  cardVO: MCPCardVO;
  onCardClick: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(cardVO.enable);
  const [switchEnable, setSwitchEnable] = useState(true);
  const [testing, setTesting] = useState(false);
  const [toolsCount, setToolsCount] = useState(cardVO.tools);
  const [status, setStatus] = useState(cardVO.status);
  const [error, setError] = useState(cardVO.error);

  useEffect(() => {
    console.log(`[MCPCard ${cardVO.name}] Status updated:`, {
      status: cardVO.status,
      tools: cardVO.tools,
      error: cardVO.error,
    });
    setStatus(cardVO.status);
    setError(cardVO.error);
    setToolsCount(cardVO.tools);
    setEnabled(cardVO.enable);
  }, [cardVO.name, cardVO.status, cardVO.error, cardVO.tools, cardVO.enable]);

  function handleEnable(checked: boolean) {
    setSwitchEnable(false);
    httpClient
      .toggleMCPServer(cardVO.name, checked)
      .then(() => {
        setEnabled(checked);
        toast.success(t('mcp.saveSuccess'));
        onRefresh();
        setSwitchEnable(true);
      })
      .catch((err) => {
        toast.error(t('mcp.modifyFailed') + err.message);
        setSwitchEnable(true);
      });
  }

  function handleTest(e: React.MouseEvent) {
    e.stopPropagation(); // 阻止事件冒泡
    setTesting(true);
    httpClient
      .testMCPServer(cardVO.name)
      .then((resp) => {
        const taskId = resp.task_id;
        // 监控任务状态
        const interval = setInterval(() => {
          httpClient.getAsyncTask(taskId).then((taskResp) => {
            if (taskResp.runtime.done) {
              clearInterval(interval);
              if (taskResp.runtime.exception) {
                toast.error(t('mcp.testFailed') + taskResp.runtime.exception);
              } else {
                // 解析测试结果获取工具数量
                try {
                  const rawResult = taskResp.runtime.result as
                    | string
                    | {
                        status?: string;
                        tools_count?: number;
                        tools_names_lists?: string[];
                        error?: string;
                      }
                    | undefined;

                  if (rawResult) {
                    let result: {
                      status?: string;
                      tools_count?: number;
                      tools_names_lists?: string[];
                      error?: string;
                    };

                    if (typeof rawResult === 'string') {
                      result = JSON.parse(rawResult.replace(/'/g, '"'));
                    } else {
                      result = rawResult;
                    }

                    if (result.tools_count !== undefined) {
                      setToolsCount(result.tools_count);
                      toast.success(
                        t('mcp.testSuccess') +
                          ` - ${result.tools_count} ${t('mcp.toolsFound')}`,
                      );
                    } else {
                      toast.success(t('mcp.testSuccess'));
                    }
                  } else {
                    toast.success(t('mcp.testSuccess'));
                  }
                } catch (parseError) {
                  console.error('Failed to parse test result:', parseError);
                  toast.success(t('mcp.testSuccess'));
                }
                onRefresh();
              }
              setTesting(false);
            }
          });
        }, 1000);
      })
      .catch((err) => {
        toast.error(t('mcp.testFailed') + err.message);
        setTesting(false);
      });
  }

  return (
    <div
      className="w-[100%] h-[10rem] bg-white dark:bg-[#1f1f22] rounded-[10px] shadow-[0px_2px_2px_0_rgba(0,0,0,0.2)] dark:shadow-none p-[1.2rem] cursor-pointer transition-all duration-200 hover:shadow-[0px_2px_8px_0_rgba(0,0,0,0.1)] dark:hover:shadow-none"
      onClick={onCardClick}
    >
      <div className="w-full h-full flex flex-row items-start justify-start gap-[1.2rem]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="64"
          height="64"
          fill="rgba(70,146,221,1)"
        >
          <path d="M17.6567 14.8284L16.2425 13.4142L17.6567 12C19.2188 10.4379 19.2188 7.90524 17.6567 6.34314C16.0946 4.78105 13.5619 4.78105 11.9998 6.34314L10.5856 7.75736L9.17139 6.34314L10.5856 4.92893C12.9287 2.58578 16.7277 2.58578 19.0709 4.92893C21.414 7.27208 21.414 11.0711 19.0709 13.4142L17.6567 14.8284ZM14.8282 17.6569L13.414 19.0711C11.0709 21.4142 7.27189 21.4142 4.92875 19.0711C2.5856 16.7279 2.5856 12.9289 4.92875 10.5858L6.34296 9.17157L7.75717 10.5858L6.34296 12C4.78086 13.5621 4.78086 16.0948 6.34296 17.6569C7.90506 19.2189 10.4377 19.2189 11.9998 17.6569L13.414 16.2426L14.8282 17.6569ZM14.8282 7.75736L16.2425 9.17157L9.17139 16.2426L7.75717 14.8284L14.8282 7.75736Z"></path>
        </svg>

        <div className="w-full h-full flex flex-col items-start justify-between gap-[0.6rem]">
          <div className="flex flex-col items-start justify-start">
            <div className="flex flex-col items-start justify-start">
              <div className="flex flex-row items-center justify-start gap-[0.4rem]">
                <div className="text-[1.2rem] text-black dark:text-[#f0f0f0] font-medium">
                  {cardVO.name}
                </div>
              </div>
            </div>

            {error && (
              <div className="text-[0.7rem] text-red-500 dark:text-red-400 line-clamp-2 mt-1">
                {error}
              </div>
            )}
          </div>

          <div className="w-full flex flex-row items-start justify-start gap-[0.6rem]">
            <div className="flex h-full flex-row items-center justify-center gap-[0.4rem]">
              <Wrench className="w-5 h-5" />
              <div className="text-base text-black dark:text-[#f0f0f0] font-medium">
                {t('mcp.toolCount', { count: toolsCount })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between h-full">
          <div
            className="flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              className="cursor-pointer"
              checked={enabled}
              onCheckedChange={handleEnable}
              disabled={!switchEnable}
            />
          </div>

          <div className="flex items-center justify-center gap-[0.4rem]">
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-8 w-8"
              onClick={(e) => handleTest(e)}
              disabled={testing}
            >
              <RefreshCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
