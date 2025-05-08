// import {
//   Form,
//   Button,
//   Switch,
//   Select,
//   Input,
//   InputNumber,
//   SelectProps,
// } from 'antd';
import { CaretLeftOutlined, CaretRightOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import styles from './pipelineFormStyle.module.css';
import { httpClient } from '@/app/infra/http/HttpClient';
import { LLMModel, Pipeline } from '@/app/infra/entities/api';
import { UUID } from 'uuidjs';
import { PipelineFormEntity, PipelineConfigTab, PipelineConfigStage } from '@/app/infra/entities/pipeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getDefaultValues,
  parseDynamicFormItemType,
} from '@/app/home/components/dynamic-form/DynamicFormItemConfig';
import { IDynamicFormItemSchema } from '@/app/infra/entities/form/dynamic';
import DynamicFormComponent from '@/app/home/components/dynamic-form/DynamicFormComponent';
import { Button } from '@/components/ui/button';
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const formSchema = z.object({
  basic: z.object({
    name: z.string().min(1, { message: '名称不能为空' }),
    description: z.string().min(1, { message: '描述不能为空' }),
  }),
  ai: z.record(z.string(), z.any()),
  trigger: z.record(z.string(), z.any()),
  safety: z.record(z.string(), z.any()),
  output: z.record(z.string(), z.any()),
});

type FormValues = z.infer<typeof formSchema>;

export default function PipelineFormComponent({
  initValues,
  onFinish,
  isEditMode,
  pipelineId,
  disableForm,
}: {
  pipelineId?: string;
  isEditMode: boolean;
  disableForm: boolean;
  // 这里的写法很不安全不规范，未来流水线需要重新整理
  initValues?: PipelineFormEntity;
  onFinish: () => void;
}) {
  const [nowFormIndex, setNowFormIndex] = useState<number>(0);
  const [nowAIRunner, setNowAIRunner] = useState('');
  // const [llmModelList, setLlmModelList] = useState<SelectProps['options']>([]);
  // 这里不好，可以改成enum等
  const formLabelList: FormLabel[] = [
    { label: '基础信息', name: 'basic' },
    { label: 'AI能力', name: 'ai' },
    { label: '触发条件', name: 'trigger' },
    { label: '安全能力', name: 'safety' },
    { label: '输出处理', name: 'output' },
  ];
  // const [basicForm] = Form.useForm();
  // const [aiForm] = Form.useForm();
  // const [triggerForm] = Form.useForm();
  // const [safetyForm] = Form.useForm();
  // const [outputForm] = Form.useForm();
  const [aiConfigTabSchema, setAIConfigTabSchema] = useState<PipelineConfigTab>();
  const [triggerConfigTabSchema, setTriggerConfigTabSchema] = useState<PipelineConfigTab>();
  const [safetyConfigTabSchema, setSafetyConfigTabSchema] = useState<PipelineConfigTab>();
  const [outputConfigTabSchema, setOutputConfigTabSchema] = useState<PipelineConfigTab>();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      basic: {},
      ai: {},
      trigger: {},
      safety: {},
      output: {},
    },
  });

  useEffect(() => {
    getLLMModelList();

    // get config schema from metadata
    httpClient.getGeneralPipelineMetadata().then((resp) => {
      for (const config of resp.configs) {
        if (config.name === 'ai') {
          setAIConfigTabSchema(config);
        } else if (config.name === 'trigger') {
          setTriggerConfigTabSchema(config);
        } else if (config.name === 'safety') {
          setSafetyConfigTabSchema(config);
        } else if (config.name === 'output') {
          setOutputConfigTabSchema(config);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (initValues) {
      form.reset(initValues);
    }
  }, [initValues, form]);

  function getLLMModelList() {
    httpClient
      .getProviderLLMModels()
      .then((resp) => {
        // setLlmModelList(
        //   resp.models.map((model: LLMModel) => {
        //     return {
        //       value: model.uuid,
        //       label: model.name,
        //     };
        //   }),
        // );
      })
      .catch((err) => {
        console.error('get LLM model list error', err);
      });
  }

  function getNowFormLabel() {
    return formLabelList[nowFormIndex];
  }

  function getPreFormLabel(): undefined | FormLabel {
    if (nowFormIndex !== undefined && nowFormIndex > 0) {
      return formLabelList[nowFormIndex - 1];
    } else {
      return undefined;
    }
  }

  function getNextFormLabel(): undefined | FormLabel {
    if (nowFormIndex !== undefined && nowFormIndex < formLabelList.length - 1) {
      return formLabelList[nowFormIndex + 1];
    } else {
      return undefined;
    }
  }

  function addFormLabelIndex() {
    if (nowFormIndex < formLabelList.length - 1) {
      setNowFormIndex(nowFormIndex + 1);
    }
  }

  function reduceFormLabelIndex() {
    if (nowFormIndex > 0) {
      setNowFormIndex(nowFormIndex - 1);
    }
  }

  function handleFormSubmit(values: FormValues) {
    if (isEditMode) {
      handleModify(values);
    } else {
      handleCreate(values);
    }
  }

  function handleCreate(values: FormValues) {
    const pipeline: Pipeline = {
      config: values,
      created_at: '',
      description: '',
      for_version: '',
      name: '',
      stages: [],
      updated_at: '',
      uuid: UUID.generate(),
      is_default: false,
    };
    httpClient.createPipeline(pipeline).then(() => onFinish());
  }

  function handleModify(values: FormValues) {

    const realConfig = {
      ai: values.ai,
      trigger: values.trigger,
      safety: values.safety,
      output: values.output,
    };
    
    const pipeline: Pipeline = {
      config: realConfig,
      // created_at: '',
      description: values.basic.description,
      // for_version: '',
      name: values.basic.name,
      // stages: [],
      // updated_at: '',
      // uuid: pipelineId || '',
      // is_default: false,
    };
    httpClient.updatePipeline(pipelineId || '', pipeline).then(() => onFinish());
  }

  function renderDynamicForms(stage: PipelineConfigStage, formName: keyof FormValues) {
    // 如果是 AI 配置，需要特殊处理
    if (formName === 'ai') {
      // 获取当前选择的 runner
      const currentRunner = form.watch('ai.runner.runner');
      
      // 如果是 runner 配置项，直接渲染
      if (stage.name === 'runner') {
        return (
          <div key={stage.name} className="space-y-4 mb-6">
            <div className="text-lg font-medium">{stage.label.zh_CN}</div>
            {stage.description && (
              <div className="text-sm text-gray-500">{stage.description.zh_CN}</div>
            )}
            <DynamicFormComponent
              itemConfigList={stage.config}
              initialValues={(form.watch(formName) as Record<string, any>)?.[stage.name] || {}}
              onSubmit={(values) => {
                const currentValues = form.getValues(formName) as Record<string, any> || {};
                form.setValue(formName, {
                  ...currentValues,
                  [stage.name]: values,
                });
              }}
            />
          </div>
        );
      }
      
      // 如果不是当前选择的 runner 对应的配置项，则不渲染
      if (stage.name !== currentRunner) {
        return null;
      }
    }

    return (
      <div key={stage.name} className="space-y-4 mb-6">
        <div className="text-lg font-medium">{stage.label.zh_CN}</div>
        {stage.description && (
          <div className="text-sm text-gray-500">{stage.description.zh_CN}</div>
        )}
        <DynamicFormComponent
          itemConfigList={stage.config}
          initialValues={(form.watch(formName) as Record<string, any>)?.[stage.name] || {}}
          onSubmit={(values) => {
            const currentValues = form.getValues(formName) as Record<string, any> || {};
            form.setValue(formName, {
              ...currentValues,
              [stage.name]: values,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <Tabs defaultValue={getNowFormLabel().name}>
            <TabsList>
              {formLabelList.map((formLabel) => (
                <TabsTrigger key={formLabel.name} value={formLabel.name}>
                  {formLabel.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {formLabelList.map((formLabel) => (
              <TabsContent key={formLabel.name} value={formLabel.name}>
                <h1 className="text-xl font-bold mb-4">{formLabel.label}</h1>
                
                {formLabel.name === 'basic' && (
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="basic.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>名称<span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="basic.description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>描述<span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {formLabel.name === 'ai' && aiConfigTabSchema && (
                  <div className="space-y-6">
                    {aiConfigTabSchema.stages.map((stage) => renderDynamicForms(stage, 'ai'))}
                  </div>
                )}

                {formLabel.name === 'trigger' && triggerConfigTabSchema && (
                  <div className="space-y-6">
                    {triggerConfigTabSchema.stages.map((stage) => renderDynamicForms(stage, 'trigger'))}
                  </div>
                )}

                {formLabel.name === 'safety' && safetyConfigTabSchema && (
                  <div className="space-y-6">
                    {safetyConfigTabSchema.stages.map((stage) => renderDynamicForms(stage, 'safety'))}
                  </div>
                )}

                {formLabel.name === 'output' && outputConfigTabSchema && (
                  <div className="space-y-6">
                    {outputConfigTabSchema.stages.map((stage) => renderDynamicForms(stage, 'output'))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <div className="sticky bottom-0 left-0 right-0 bg-background border-t p-4 mt-4">
            <div className="flex justify-end gap-2">
              <Button type="submit">
                {isEditMode ? '保存' : '提交'}
              </Button>
              <Button type="button" variant="outline" onClick={onFinish}>
                取消
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

interface FormLabel {
  label: string;
  name: string;
}
