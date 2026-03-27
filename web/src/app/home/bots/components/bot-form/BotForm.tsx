import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IChooseAdapterEntity,
  IPipelineEntity,
} from '@/app/home/bots/components/bot-form/ChooseEntity';
import {
  DynamicFormItemConfig,
  getDefaultValues,
  parseDynamicFormItemType,
} from '@/app/home/components/dynamic-form/DynamicFormItemConfig';
import { IDynamicFormItemSchema } from '@/app/infra/entities/form/dynamic';
import { UUID } from 'uuidjs';
import DynamicFormComponent from '@/app/home/components/dynamic-form/DynamicFormComponent';
import { httpClient } from '@/app/infra/http/HttpClient';
import { Bot } from '@/app/infra/entities/api';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { extractI18nObject } from '@/i18n/I18nProvider';
import { CustomApiError } from '@/app/infra/entities/common';

const getFormSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, { message: t('bots.botNameRequired') }),
    description: z
      .string()
      .min(1, { message: t('bots.botDescriptionRequired') }),
    adapter: z.string().min(1, { message: t('bots.adapterRequired') }),
    adapter_config: z.record(z.string(), z.any()),
    enable: z.boolean().optional(),
    use_pipeline_uuid: z.string().optional(),
  });

export default function BotForm({
  initBotId,
  onFormSubmit,
  onBotDeleted,
  onNewBotCreated,
  onDirtyChange,
}: {
  initBotId?: string;
  onFormSubmit: (value: z.infer<ReturnType<typeof getFormSchema>>) => void;
  onBotDeleted: () => void;
  onNewBotCreated: (botId: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const formSchema = getFormSchema(t);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: t('bots.defaultDescription'),
      adapter: '',
      adapter_config: {},
      enable: true,
      use_pipeline_uuid: '',
    },
  });

  // Track whether initial data loading is complete.
  // setValue calls during init should NOT mark the form as dirty.
  const isInitializing = useRef(true);

  const [adapterNameToDynamicConfigMap, setAdapterNameToDynamicConfigMap] =
    useState(new Map<string, IDynamicFormItemSchema[]>());
  const [showDynamicForm, setShowDynamicForm] = useState<boolean>(false);
  const [adapterNameList, setAdapterNameList] = useState<
    IChooseAdapterEntity[]
  >([]);
  const [adapterDescriptionList, setAdapterDescriptionList] = useState<
    Record<string, string>
  >({});

  const [pipelineNameList, setPipelineNameList] = useState<IPipelineEntity[]>(
    [],
  );

  const [dynamicFormConfigList, setDynamicFormConfigList] = useState<
    IDynamicFormItemSchema[]
  >([]);
  const [, setIsLoading] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [extraWebhookUrl, setExtraWebhookUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [extraCopied, setExtraCopied] = useState<boolean>(false);

  // Watch adapter and adapter_config for filtering
  const currentAdapter = form.watch('adapter');
  const currentAdapterConfig = form.watch('adapter_config');

  // Derive the filtered config list via useMemo instead of useEffect+setState
  // to avoid creating new array references that would cause DynamicFormComponent
  // to re-subscribe its form.watch, re-emit values, and trigger an infinite loop.
  // Only depend on the specific field we care about (enable-webhook) rather than
  // the entire currentAdapterConfig object, which changes on every emission.
  const enableWebhook = currentAdapterConfig?.['enable-webhook'];
  const filteredDynamicFormConfigList = useMemo(() => {
    if (currentAdapter === 'lark' && enableWebhook === false) {
      // Hide encrypt-key field when webhook is disabled
      return dynamicFormConfigList.filter(
        (config) => config.name !== 'encrypt-key',
      );
    }
    // For non-Lark adapters or when webhook is enabled/undefined, show all fields
    return dynamicFormConfigList;
  }, [currentAdapter, enableWebhook, dynamicFormConfigList]);

  // Notify parent when dirty state changes
  const { isDirty } = form.formState;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    setBotFormValues();
  }, []);

  const copyToClipboard = (
    text: string,
    setStatus: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setStatus(true);
          setTimeout(() => setStatus(false), 2000);
        })
        .catch(() => {
          fallbackCopy(text, setStatus);
        });
    } else {
      fallbackCopy(text, setStatus);
    }
  };

  const fallbackCopy = (
    text: string,
    setStatus: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (successful) {
      setStatus(true);
      setTimeout(() => setStatus(false), 2000);
    }
  };

  function setBotFormValues() {
    isInitializing.current = true;
    initBotFormComponent().then(() => {
      if (initBotId) {
        getBotConfig(initBotId)
          .then((val) => {
            // Use form.reset() to set values AND update the dirty baseline,
            // so isDirty stays false after initial load.
            form.reset({
              name: val.name,
              description: val.description,
              adapter: val.adapter,
              adapter_config: val.adapter_config,
              enable: val.enable,
              use_pipeline_uuid: val.use_pipeline_uuid || '',
            });
            handleAdapterSelect(val.adapter);

            if (val.webhook_full_url) {
              setWebhookUrl(val.webhook_full_url);
            } else {
              setWebhookUrl('');
            }
            setExtraWebhookUrl(val.extra_webhook_full_url || '');
          })
          .catch((err) => {
            toast.error(
              t('bots.getBotConfigError') + (err as CustomApiError).msg,
            );
          })
          .finally(() => {
            isInitializing.current = false;
          });
      } else {
        form.reset();
        setWebhookUrl('');
        setExtraWebhookUrl('');
        isInitializing.current = false;
      }
    });
  }

  async function initBotFormComponent() {
    const pipelinesRes = await httpClient.getPipelines();
    setPipelineNameList(
      pipelinesRes.pipelines.map((item) => {
        return {
          label: item.name,
          value: item.uuid ?? '',
        };
      }),
    );

    const adaptersRes = await httpClient.getAdapters();
    setAdapterNameList(
      adaptersRes.adapters.map((item) => {
        return {
          label: extractI18nObject(item.label),
          value: item.name,
        };
      }),
    );

    setAdapterDescriptionList(
      adaptersRes.adapters.reduce(
        (acc, item) => {
          acc[item.name] = extractI18nObject(item.description);
          return acc;
        },
        {} as Record<string, string>,
      ),
    );

    adaptersRes.adapters.forEach((rawAdapter) => {
      adapterNameToDynamicConfigMap.set(
        rawAdapter.name,
        rawAdapter.spec.config.map(
          (item) =>
            new DynamicFormItemConfig({
              default: item.default,
              id: UUID.generate(),
              label: item.label,
              description: item.description,
              name: item.name,
              required: item.required,
              type: parseDynamicFormItemType(item.type),
              options: item.options,
              show_if: item.show_if,
            }),
        ),
      );
    });
    setAdapterNameToDynamicConfigMap(adapterNameToDynamicConfigMap);
  }

  async function getBotConfig(botId: string): Promise<
    z.infer<typeof formSchema> & {
      webhook_full_url?: string;
      extra_webhook_full_url?: string;
    }
  > {
    return new Promise((resolve, reject) => {
      httpClient
        .getBot(botId)
        .then((res) => {
          const bot = res.bot;
          const runtimeValues = bot.adapter_runtime_values as
            | Record<string, unknown>
            | undefined;
          resolve({
            adapter: bot.adapter,
            description: bot.description,
            name: bot.name,
            adapter_config: bot.adapter_config,
            enable: bot.enable ?? true,
            use_pipeline_uuid: bot.use_pipeline_uuid ?? '',
            webhook_full_url: runtimeValues?.webhook_full_url as
              | string
              | undefined,
            extra_webhook_full_url: runtimeValues?.extra_webhook_full_url as
              | string
              | undefined,
          });
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  function handleAdapterSelect(adapterName: string) {
    if (adapterName) {
      const dynamicFormConfigList =
        adapterNameToDynamicConfigMap.get(adapterName);
      if (dynamicFormConfigList) {
        setDynamicFormConfigList(dynamicFormConfigList);
        if (!initBotId) {
          form.setValue(
            'adapter_config',
            getDefaultValues(dynamicFormConfigList),
          );
        }
      }
      setShowDynamicForm(true);
    } else {
      setShowDynamicForm(false);
    }
  }

  function onDynamicFormSubmit() {
    setIsLoading(true);
    if (initBotId) {
      const updateBot: Bot = {
        uuid: initBotId,
        name: form.getValues().name,
        description: form.getValues().description,
        adapter: form.getValues().adapter,
        adapter_config: form.getValues().adapter_config,
        enable: form.getValues().enable,
        use_pipeline_uuid: form.getValues().use_pipeline_uuid,
      };
      httpClient
        .updateBot(initBotId, updateBot)
        .then(() => {
          // Reset dirty baseline to current values so isDirty becomes false
          form.reset(form.getValues());
          onFormSubmit(form.getValues());
          toast.success(t('bots.saveSuccess'));
        })
        .catch((err) => {
          toast.error(t('bots.saveError') + err.msg);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      const newBot: Bot = {
        name: form.getValues().name,
        description: form.getValues().description,
        adapter: form.getValues().adapter,
        adapter_config: form.getValues().adapter_config,
      };
      httpClient
        .createBot(newBot)
        .then((res) => {
          toast.success(t('bots.createSuccess'));
          initBotId = res.uuid;

          setBotFormValues();

          onNewBotCreated(res.uuid);
        })
        .catch((err) => {
          toast.error(t('bots.createError') + err.msg);
        })
        .finally(() => {
          setIsLoading(false);
          form.reset();
        });
    }
  }

  // --- Webhook URL display helper ---
  const showWebhook =
    initBotId &&
    webhookUrl &&
    (currentAdapter !== 'lark' || enableWebhook !== false);

  return (
    <Form {...form}>
      <form
        id="bot-form"
        onSubmit={form.handleSubmit(onDynamicFormSubmit)}
        className="space-y-6"
      >
        {/* Card 1: Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bots.basicInfo')}</CardTitle>
            <CardDescription>{t('bots.basicInfoDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('bots.botName')}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('bots.botDescription')}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Card 2: Pipeline Binding (edit mode only) */}
        {initBotId && (
          <Card>
            <CardHeader>
              <CardTitle>{t('bots.routingConnection')}</CardTitle>
              <CardDescription>
                {t('bots.routingConnectionDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="use_pipeline_uuid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bots.bindPipeline')}</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} {...field}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('bots.selectPipeline')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {pipelineNameList.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Card 3: Adapter Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bots.adapterConfig')}</CardTitle>
            <CardDescription>
              {t('bots.adapterConfigDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="adapter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('bots.platformAdapter')}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleAdapterSelect(value);
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue placeholder={t('bots.selectAdapter')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {adapterNameList.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  {currentAdapter && adapterDescriptionList[currentAdapter] && (
                    <FormDescription>
                      {adapterDescriptionList[currentAdapter]}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Webhook URL: shown after adapter is selected (edit mode only) */}
            {showWebhook && (
              <FormItem>
                <FormLabel>{t('bots.webhookUrl')}</FormLabel>
                <div className="flex items-center gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="flex-1 bg-muted"
                    onClick={(e) => {
                      (e.target as HTMLInputElement).select();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl, setCopied)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {extraWebhookUrl && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={extraWebhookUrl}
                      readOnly
                      className="flex-1 bg-muted"
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(extraWebhookUrl, setExtraCopied)
                      }
                    >
                      {extraCopied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
                <FormDescription>
                  {extraWebhookUrl
                    ? t('bots.webhookUrlHintEither')
                    : t('bots.webhookUrlHint')}
                </FormDescription>
              </FormItem>
            )}

            {showDynamicForm && filteredDynamicFormConfigList.length > 0 && (
              <DynamicFormComponent
                itemConfigList={filteredDynamicFormConfigList}
                initialValues={currentAdapterConfig}
                onSubmit={(values) => {
                  form.setValue('adapter_config', values, {
                    shouldDirty: !isInitializing.current,
                  });
                }}
              />
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
