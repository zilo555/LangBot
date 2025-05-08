import { useEffect, useState } from 'react';
import { IChooseAdapterEntity, IPipelineEntity } from '@/app/home/bots/components/bot-form/ChooseEntity';
import {
  DynamicFormItemConfig,
  IDynamicFormItemConfig,
  getDefaultValues,
  parseDynamicFormItemType,
} from '@/app/home/components/dynamic-form/DynamicFormItemConfig';
import { UUID } from 'uuidjs';
import DynamicFormComponent from '@/app/home/components/dynamic-form/DynamicFormComponent';
import { httpClient } from '@/app/infra/http/HttpClient';
import { Bot } from '@/app/infra/api/api-types';

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

const formSchema = z.object({
  name: z.string().min(1, { message: '机器人名称不能为空' }),
  description: z.string().min(1, { message: '机器人描述不能为空' }),
  adapter: z.string().min(1, { message: '适配器不能为空' }),
  adapter_config: z.record(z.string(), z.any()),
  enable: z.boolean(),
  use_pipeline_uuid: z.string().min(1, { message: '流水线不能为空' }),
});

export default function BotForm({
  initBotId,
  onFormSubmit,
  onFormCancel,
  onBotDeleted,
}: {
  initBotId?: string;
  onFormSubmit: (value: z.infer<typeof formSchema>) => void;
  onFormCancel: () => void;
  onBotDeleted: () => void;
}) {

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '一个机器人',
      adapter: '',
      adapter_config: {},
      enable: true,
      use_pipeline_uuid: '',
    },
  });


  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const [adapterNameToDynamicConfigMap, setAdapterNameToDynamicConfigMap] =
    useState(new Map<string, IDynamicFormItemConfig[]>());
  // const [form] = Form.useForm<IBotFormEntity>();
  const [showDynamicForm, setShowDynamicForm] = useState<boolean>(false);
  // const [dynamicForm] = Form.useForm();
  const [adapterNameList, setAdapterNameList] = useState<
    IChooseAdapterEntity[]
  >([]);
  const [adapterIconList, setAdapterIconList] = useState<
    Record<string, string>
  >({});
  const [adapterDescriptionList, setAdapterDescriptionList] = useState<
    Record<string, string>
  >({});

  const [pipelineNameList, setPipelineNameList] = useState<
    IPipelineEntity[]
  >([]);

  const [dynamicFormConfigList, setDynamicFormConfigList] = useState<
    IDynamicFormItemConfig[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    initBotFormComponent();

    // 拉取初始化表单信息
    if (initBotId) {
      getBotConfig(initBotId).then((val) => {
        form.setValue('name', val.name);
        form.setValue('description', val.description);
        form.setValue('adapter', val.adapter);
        form.setValue('adapter_config', val.adapter_config);
        form.setValue('enable', val.enable);
        form.setValue('use_pipeline_uuid', val.use_pipeline_uuid || '');
        console.log('form', form.getValues());
        handleAdapterSelect(val.adapter);
        // dynamicForm.setFieldsValue(val.adapter_config);
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initBotFormComponent() {
    // 拉取adapter
    const rawAdapterList = await httpClient.getAdapters();
    // 初始化适配器选择列表
    setAdapterNameList(
      rawAdapterList.adapters.map((item) => {
        return {
          label: item.label.zh_CN,
          value: item.name,
        };
      }),
    );

    // 初始化适配器图标列表
    setAdapterIconList(
      rawAdapterList.adapters.reduce((acc, item) => {
        acc[item.name] = httpClient.getAdapterIconURL(item.name);
        return acc;
      }, {} as Record<string, string>),
    );

    // 初始化适配器描述列表
    setAdapterDescriptionList(
      rawAdapterList.adapters.reduce((acc, item) => {
        acc[item.name] = item.description.zh_CN;
        return acc;
      }, {} as Record<string, string>),
    );

    if (initBotId) {
      // 初始化流水线列表
      const rawPipelineList = await httpClient.getPipelines();
      setPipelineNameList(
        rawPipelineList.pipelines.map((item) => {
          return {
            label: item.name,
            value: item.uuid,
          };
        }),
      );
    }

    // 初始化适配器表单map
    rawAdapterList.adapters.forEach((rawAdapter) => {
      adapterNameToDynamicConfigMap.set(
        rawAdapter.name,
        rawAdapter.spec.config.map(
          (item) =>
            new DynamicFormItemConfig({
              default: item.default,
              id: UUID.generate(),
              label: item.label,
              name: item.name,
              required: item.required,
              type: parseDynamicFormItemType(item.type),
            }),
        ),
      );
    });
    setAdapterNameToDynamicConfigMap(adapterNameToDynamicConfigMap);
  }

  async function onCreateMode() { }

  function onEditMode() {
    console.log('onEditMode', form.getValues());

  }

  async function getBotConfig(botId: string): Promise<z.infer<typeof formSchema>> {
    const bot = (await httpClient.getBot(botId)).bot;
    return {
      adapter: bot.adapter,
      description: bot.description,
      name: bot.name,
      adapter_config: bot.adapter_config,
      enable: bot.enable ?? true,
      use_pipeline_uuid: bot.use_pipeline_uuid,
    };
  }

  function handleAdapterSelect(adapterName: string) {
    console.log('Select adapter: ', adapterName);
    if (adapterName) {
      const dynamicFormConfigList =
        adapterNameToDynamicConfigMap.get(adapterName);
      console.log(dynamicFormConfigList);
      if (dynamicFormConfigList) {
        setDynamicFormConfigList(dynamicFormConfigList);
        if (!initBotId) {
          form.setValue('adapter_config', getDefaultValues(dynamicFormConfigList));
        }
      }
      setShowDynamicForm(true);
    } else {
      setShowDynamicForm(false);
    }
  }

  function handleSubmitButton() {
    // form.submit();
  }

  function handleFormFinish() {
    // dynamicForm.submit();
  }

  // 只有通过外层固定表单验证才会走到这里，真正的提交逻辑在这里
  function onDynamicFormSubmit(value: object) {
    setIsLoading(true);
    console.log('set loading', true);
    if (initBotId) {
      // 编辑提交
      // console.log('submit edit', form.getFieldsValue(), value);
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
        .then((res) => {
          // TODO success toast
          console.log('update bot success', res);
          onFormSubmit(form.getValues());
          // notification.success({
          //   message: '更新成功',
          //   description: '机器人更新成功',
          // });
        })
        .catch(() => {
          // TODO error toast
          // notification.error({
          //   message: '更新失败',
          //   description: '机器人更新失败',
          // });
        })
        .finally(() => {
          setIsLoading(false);
          form.reset();
          // dynamicForm.resetFields();
        });
    } else {
      // 创建提交
      console.log('submit create', form.getValues(), value);
      const newBot: Bot = {
        name: form.getValues().name,
        description: form.getValues().description,
        adapter: form.getValues().adapter,
        adapter_config: form.getValues().adapter_config,
      };
      httpClient
        .createBot(newBot)
        .then((res) => {
          // TODO success toast
          // notification.success({
          //   message: '创建成功',
          //   description: '机器人创建成功',
          // });
          console.log(res);
          onFormSubmit(form.getValues());
        })
        .catch(() => {
          // TODO error toast
          // notification.error({
          //   message: '创建失败',
          //   description: '机器人创建失败',
          // });
        })
        .finally(() => {
          setIsLoading(false);
          form.reset();
          // dynamicForm.resetFields();
        });
    }
    setShowDynamicForm(false);
    console.log('set loading', false);
    // TODO 刷新bot列表
    // TODO 关闭当前弹窗 Already closed @setShowDynamicForm(false)?
  }

  function handleSaveButton() {
    form.handleSubmit(onDynamicFormSubmit)();
  }

  function deleteBot() {
    if (initBotId) {
      httpClient.deleteBot(initBotId).then(() => {
        onBotDeleted();
      });
    }
  }

  return (
    <div>
      <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除确认</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            你确定要删除这个机器人吗？
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmModal(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => {
              deleteBot();
              setShowDeleteConfirmModal(false);
            }}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onDynamicFormSubmit)} className="space-y-8">
          <div className="space-y-4">
            {/* 是否启用 & 绑定流水线  仅在编辑模式 */}
            {initBotId && (
              <div className="flex items-center gap-6">
              <FormField
                control={form.control}
                name="enable"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-start gap-[0.8rem] h-[3.8rem]">
                    <FormLabel>是否启用</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="use_pipeline_uuid"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-start gap-[0.8rem] h-[3.8rem]">
                    <FormLabel>绑定流水线</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        {...field}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择流水线" />
                        </SelectTrigger>
                        <SelectContent className="fixed z-[1000]">
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
              </div>

            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>机器人名称<span className="text-red-500">*</span></FormLabel>
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
                  <FormLabel>机器人描述<span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adapter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>平台/适配器选择<span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleAdapterSelect(value);
                        }}
                        value={field.value}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="选择适配器" />
                        </SelectTrigger>
                        <SelectContent className="fixed z-[1000]">
                          <SelectGroup>
                            {adapterNameList.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('adapter') && (
              <div className="flex items-start gap-3 p-4 rounded-lg border">
                <img
                  src={adapterIconList[form.watch('adapter')]}
                  alt="adapter icon"
                  className="w-12 h-12"
                />
                <div className="flex flex-col gap-1">
                  <div className="font-medium">
                    {adapterNameList.find(item => item.value === form.watch('adapter'))?.label}
                  </div>
                  <div className="text-sm text-gray-500">
                    {adapterDescriptionList[form.watch('adapter')]}
                  </div>
                </div>
              </div>
            )}

            {showDynamicForm && dynamicFormConfigList.length > 0 && (
              <div className="space-y-4">
                <div className="text-lg font-medium">适配器配置</div>
                <DynamicFormComponent
                  itemConfigList={dynamicFormConfigList}
                  initialValues={form.watch('adapter_config')}
                  onSubmit={(values) => {
                    form.setValue('adapter_config', values);
                  }}
                />
              </div>
            )}

          </div>

          <div className="sticky bottom-0 left-0 right-0 bg-background border-t p-4 mt-4">
            <div className="flex justify-end gap-2">
              {!initBotId && (
                <Button type="submit" onClick={form.handleSubmit(onDynamicFormSubmit)}>提交</Button>
              )}
              {initBotId && (
                <>
                  <Button type="button" variant="destructive" onClick={() => setShowDeleteConfirmModal(true)}>
                    删除
                  </Button>
                  <Button type="button" onClick={form.handleSubmit(onDynamicFormSubmit)}>
                    保存
                  </Button>
                </>
              )}
              <Button type="button" onClick={() => onFormCancel()}>
                取消
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
