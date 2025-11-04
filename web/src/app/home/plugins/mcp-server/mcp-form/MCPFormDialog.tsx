'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Resolver, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { httpClient } from '@/app/infra/http/HttpClient';

const getFormSchema = (t: (key: string) => string) =>
  z.object({
    name: z
      .string({ required_error: t('mcp.nameRequired') })
      .min(1, { message: t('mcp.nameRequired') }),
    timeout: z
      .number({ invalid_type_error: t('mcp.timeoutMustBeNumber') })
      .positive({ message: t('mcp.timeoutMustBePositive') })
      .default(30),
    ssereadtimeout: z
      .number({ invalid_type_error: t('mcp.sseTimeoutMustBeNumber') })
      .positive({ message: t('mcp.timeoutMustBePositive') })
      .default(300),
    url: z
      .string({ required_error: t('mcp.urlRequired') })
      .min(1, { message: t('mcp.urlRequired') }),
    extra_args: z
      .array(
        z.object({
          key: z.string(),
          type: z.enum(['string', 'number', 'boolean']),
          value: z.string(),
        }),
      )
      .optional(),
  });

type FormValues = z.infer<ReturnType<typeof getFormSchema>> & {
  timeout: number;
  ssereadtimeout: number;
};

interface MCPFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName?: string | null;
  isEditMode?: boolean;
  onSuccess?: () => void;
  onDelete?: () => void;
  onUpdateToolsCache?: (serverName: string, toolsCount: number) => void;
}

export default function MCPFormDialog({
  open,
  onOpenChange,
  serverName,
  isEditMode = false,
  onSuccess,
  onDelete,
  onUpdateToolsCache,
}: MCPFormDialogProps) {
  const { t } = useTranslation();
  const formSchema = getFormSchema(t);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      name: '',
      url: '',
      timeout: 30,
      ssereadtimeout: 300,
      extra_args: [],
    },
  });

  const [extraArgs, setExtraArgs] = useState<
    { key: string; type: 'string' | 'number' | 'boolean'; value: string }[]
  >([]);
  const [mcpTesting, setMcpTesting] = useState(false);
  const [mcpTestStatus, setMcpTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'failed'
  >('idle');
  const [mcpToolNames, setMcpToolNames] = useState<string[]>([]);
  const [mcpTestError, setMcpTestError] = useState<string>('');

  // Load server data when editing
  useEffect(() => {
    if (open && isEditMode && serverName) {
      loadServerForEdit(serverName);
    } else if (open && !isEditMode) {
      // Reset form when creating new server
      form.reset();
      setExtraArgs([]);
      setMcpTestStatus('idle');
      setMcpToolNames([]);
      setMcpTestError('');
    }
  }, [open, isEditMode, serverName]);

  async function loadServerForEdit(serverName: string) {
    try {
      const resp = await httpClient.getMCPServer(serverName);
      const server = resp.server ?? resp;

      const extraArgs = server.extra_args;
      form.setValue('name', server.name);
      form.setValue('url', extraArgs.url);
      form.setValue('timeout', extraArgs.timeout);
      form.setValue('ssereadtimeout', extraArgs.ssereadtimeout);

      if (extraArgs.headers) {
        const headers = Object.entries(extraArgs.headers).map(
          ([key, value]) => ({
            key,
            type: 'string' as const,
            value: String(value),
          }),
        );
        setExtraArgs(headers);
        form.setValue('extra_args', headers);
      }

      setMcpTestStatus('testing');
      setMcpToolNames([]);
      setMcpTestError('');

      try {
        const res = await httpClient.testMCPServer(server.name);
        if (res.task_id) {
          const taskId = res.task_id;

          const interval = setInterval(() => {
            httpClient
              .getAsyncTask(taskId)
              .then((taskResp) => {
                if (taskResp.runtime && taskResp.runtime.done) {
                  clearInterval(interval);

                  if (taskResp.runtime.exception) {
                    setMcpTestStatus('failed');
                    setMcpToolNames([]);
                    setMcpTestError(taskResp.runtime.exception || '未知错误');
                  } else if (taskResp.runtime.result) {
                    try {
                      let result: {
                        status?: string;
                        tools_count?: number;
                        tools_names_lists?: string[];
                        error?: string;
                      };

                      const rawResult: unknown = taskResp.runtime.result;
                      if (typeof rawResult === 'string') {
                        result = JSON.parse(rawResult.replace(/'/g, '"'));
                      } else {
                        result = rawResult as typeof result;
                      }

                      if (
                        result.tools_names_lists &&
                        result.tools_names_lists.length > 0
                      ) {
                        setMcpTestStatus('success');
                        setMcpToolNames(result.tools_names_lists);
                        // Update tools cache
                        if (onUpdateToolsCache && serverName) {
                          onUpdateToolsCache(
                            serverName,
                            result.tools_names_lists.length,
                          );
                        }
                      } else {
                        setMcpTestStatus('failed');
                        setMcpToolNames([]);
                        setMcpTestError('未找到任何工具');
                      }
                    } catch (parseError) {
                      setMcpTestStatus('failed');
                      setMcpToolNames([]);
                      setMcpTestError('解析测试结果失败');
                    }
                  } else {
                    setMcpTestStatus('failed');
                    setMcpToolNames([]);
                    setMcpTestError('测试未返回结果');
                  }
                }
              })
              .catch((err) => {
                clearInterval(interval);
                setMcpTestStatus('failed');
                setMcpToolNames([]);
                setMcpTestError(err.message || '获取任务状态失败');
              });
          }, 1000);
        } else {
          setMcpTestStatus('failed');
          setMcpToolNames([]);
          setMcpTestError('未获取到任务ID');
        }
      } catch (error) {
        setMcpTestStatus('failed');
        setMcpToolNames([]);
        setMcpTestError((error as Error).message || '测试连接时发生错误');
      }
    } catch (error) {
      console.error('Failed to load server:', error);
      toast.error(t('mcp.loadFailed'));
    }
  }

  async function handleFormSubmit(value: z.infer<typeof formSchema>) {
    const extraArgsObj: Record<string, string | number | boolean> = {};
    value.extra_args?.forEach(
      (arg: { key: string; type: string; value: string }) => {
        if (arg.type === 'number') {
          extraArgsObj[arg.key] = Number(arg.value);
        } else if (arg.type === 'boolean') {
          extraArgsObj[arg.key] = arg.value === 'true';
        } else {
          extraArgsObj[arg.key] = arg.value;
        }
      },
    );

    try {
      const serverConfig = {
        name: value.name,
        mode: 'sse' as const,
        enable: true,
        url: value.url,
        headers: extraArgsObj as Record<string, string>,
        timeout: value.timeout,
        ssereadtimeout: value.ssereadtimeout,
      };

      if (isEditMode && serverName) {
        await httpClient.updateMCPServer(serverName, serverConfig);
        toast.success(t('mcp.updateSuccess'));
      } else {
        await httpClient.createMCPServer({
          extra_args: {
            url: value.url,
            headers: extraArgsObj as Record<string, string>,
            timeout: value.timeout,
            ssereadtimeout: value.ssereadtimeout,
          },
          name: value.name,
          mode: 'sse' as const,
          enable: true,
        });
        toast.success(t('mcp.createSuccess'));
      }

      onOpenChange(false);
      form.reset();
      setExtraArgs([]);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to save MCP server:', error);
      toast.error(isEditMode ? t('mcp.updateFailed') : t('mcp.createFailed'));
    }
  }

  function testMcp() {
    setMcpTesting(true);
    const extraArgsObj: Record<string, string | number | boolean> = {};
    form
      .getValues('extra_args')
      ?.forEach((arg: { key: string; type: string; value: string }) => {
        if (arg.type === 'number') {
          extraArgsObj[arg.key] = Number(arg.value);
        } else if (arg.type === 'boolean') {
          extraArgsObj[arg.key] = arg.value === 'true';
        } else {
          extraArgsObj[arg.key] = arg.value;
        }
      });
    httpClient
      .testMCPServer(form.getValues('name'))
      .then((res) => {
        if (res.task_id) {
          const taskId = res.task_id;

          const interval = setInterval(() => {
            httpClient
              .getAsyncTask(taskId)
              .then((taskResp) => {
                if (taskResp.runtime && taskResp.runtime.done) {
                  clearInterval(interval);
                  setMcpTesting(false);

                  if (taskResp.runtime.exception) {
                    toast.error(
                      t('mcp.testError') +
                        ': ' +
                        (taskResp.runtime.exception || t('mcp.unknownError')),
                    );
                  } else if (taskResp.runtime.result) {
                    try {
                      let result: {
                        status?: string;
                        tools_count?: number;
                        tools_names_lists?: string[];
                        error?: string;
                      };

                      const rawResult: unknown = taskResp.runtime.result;
                      if (typeof rawResult === 'string') {
                        result = JSON.parse(rawResult.replace(/'/g, '"'));
                      } else {
                        result = rawResult as typeof result;
                      }

                      if (
                        result.tools_names_lists &&
                        result.tools_names_lists.length > 0
                      ) {
                        toast.success(
                          t('mcp.testSuccess') +
                            ' - ' +
                            result.tools_names_lists.length +
                            ' ' +
                            t('mcp.toolsFound'),
                        );
                      } else {
                        toast.error(
                          t('mcp.testError') + ': ' + t('mcp.noToolsFound'),
                        );
                      }
                    } catch (parseError) {
                      console.error('Failed to parse test result:', parseError);
                      toast.error(
                        t('mcp.testError') + ': ' + t('mcp.parseResultFailed'),
                      );
                    }
                  } else {
                    toast.error(
                      t('mcp.testError') + ': ' + t('mcp.noResultReturned'),
                    );
                  }
                }
              })
              .catch((err) => {
                console.error('获取测试任务状态失败:', err);
                clearInterval(interval);
                setMcpTesting(false);
                toast.error(
                  t('mcp.testError') +
                    ': ' +
                    (err.message || t('mcp.getTaskFailed')),
                );
              });
          }, 1000);
        } else {
          setMcpTesting(false);
          toast.error(t('mcp.testError') + ': ' + t('mcp.noTaskId'));
        }
      })
      .catch((err) => {
        console.error('启动测试失败:', err);
        setMcpTesting(false);
        toast.error(
          t('mcp.testError') + ': ' + (err.message || t('mcp.unknownError')),
        );
      });
  }

  const addExtraArg = () => {
    setExtraArgs([...extraArgs, { key: '', type: 'string', value: '' }]);
  };

  const removeExtraArg = (index: number) => {
    const newArgs = extraArgs.filter((_, i) => i !== index);
    setExtraArgs(newArgs);
    form.setValue('extra_args', newArgs);
  };

  const updateExtraArg = (
    index: number,
    field: 'key' | 'type' | 'value',
    value: string,
  ) => {
    const newArgs = [...extraArgs];
    newArgs[index] = {
      ...newArgs[index],
      [field]: value,
    };
    setExtraArgs(newArgs);
    form.setValue('extra_args', newArgs);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          form.reset();
          setExtraArgs([]);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('mcp.editServer') : t('mcp.createServer')}
          </DialogTitle>
        </DialogHeader>

        {isEditMode && (
          <div className="mb-4 p-3 rounded-lg border">
            {mcpTestStatus === 'testing' && (
              <div className="flex items-center gap-2 text-blue-600">
                <svg
                  className="w-5 h-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="font-medium">{t('mcp.testing')}</span>
              </div>
            )}

            {mcpTestStatus === 'success' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg
                    className="w-5 h-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium">
                    {t('mcp.connectionSuccess')} - {mcpToolNames.length}{' '}
                    {t('mcp.toolsFound')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {mcpToolNames.map((toolName, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-md"
                    >
                      {toolName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {mcpTestStatus === 'failed' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-red-600">
                  <svg
                    className="w-5 h-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium">
                    {t('mcp.connectionFailed')}
                  </span>
                </div>
                {mcpTestError && (
                  <div className="text-sm text-red-500 pl-7">
                    {mcpTestError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('mcp.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('mcp.url')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('mcp.timeout')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t('mcp.timeout')}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ssereadtimeout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('mcp.sseTimeout')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t('mcp.sseTimeoutDescription')}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>{t('models.extraParameters')}</FormLabel>
                <div className="space-y-2">
                  {extraArgs.map((arg, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={t('models.keyName')}
                        value={arg.key}
                        onChange={(e) =>
                          updateExtraArg(index, 'key', e.target.value)
                        }
                      />
                      <Select
                        value={arg.type}
                        onValueChange={(value) =>
                          updateExtraArg(index, 'type', value)
                        }
                      >
                        <SelectTrigger className="w-[120px] bg-[#ffffff] dark:bg-[#2a2a2e]">
                          <SelectValue placeholder={t('models.type')} />
                        </SelectTrigger>
                        <SelectContent className="bg-[#ffffff] dark:bg-[#2a2a2e]">
                          <SelectItem value="string">
                            {t('models.string')}
                          </SelectItem>
                          <SelectItem value="number">
                            {t('models.number')}
                          </SelectItem>
                          <SelectItem value="boolean">
                            {t('models.boolean')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={t('models.value')}
                        value={arg.value}
                        onChange={(e) =>
                          updateExtraArg(index, 'value', e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="p-2 hover:bg-gray-100 rounded"
                        onClick={() => removeExtraArg(index)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-red-500"
                        >
                          <path d="M7 4V2H17V4H22V6H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V6H2V4H7ZM6 6V20H18V6H6ZM9 9H11V17H9V9ZM13 9H15V17H13V9Z"></path>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addExtraArg}>
                    {t('models.addParameter')}
                  </Button>
                </div>
                <FormDescription>
                  {t('mcp.extraParametersDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>

              <DialogFooter>
                {isEditMode && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={onDelete}
                  >
                    {t('common.delete')}
                  </Button>
                )}

                <Button type="submit">
                  {isEditMode ? t('common.save') : t('common.submit')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => testMcp()}
                  disabled={mcpTesting}
                >
                  {t('common.test')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    form.reset();
                    setExtraArgs([]);
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
