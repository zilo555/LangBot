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

  // useEffect(() => {
  //   console.log('initValues change: ', initValues);
  //   if (initValues) {
  //     // basicForm.setFieldsValue(initValues.basic);
  //     // aiForm.setFieldsValue(initValues.ai);
  //     // triggerForm.setFieldsValue(initValues.trigger);
  //     // safetyForm.setFieldsValue(initValues.safety);
  //     // outputForm.setFieldsValue(initValues.output);
  //   }
  // }, [aiForm, basicForm, initValues, outputForm, safetyForm, triggerForm]);

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

  function handleCommit() {
    if (isEditMode) {
      handleModify();
    } else {
      handleCreate();
    }
  }

  function handleCreate() {
    // Promise.all([
    //   // basicForm.validateFields(),
    //   // aiForm.validateFields(),
    //   // triggerForm.validateFields(),
    //   // safetyForm.validateFields(),
    //   // outputForm.validateFields(),
    // ])
    //   .then(() => {
    //     const pipeline = assembleForm();
    //     httpClient.createPipeline(pipeline).then(() => onFinish());
    //   })
    //   .catch((e) => {
    //     console.error(e);
    //   });
  }

  function handleModify() {
    // Promise.all([
    //   // basicForm.validateFields(),
    //   // aiForm.validateFields(),
    //   // triggerForm.validateFields(),
    //   // safetyForm.validateFields(),
    //   // outputForm.validateFields(),
    // ])
    //   .then(() => {
    //     const pipeline = assembleForm();
    //     httpClient
    //       .updatePipeline(pipelineId || '', pipeline)
    //       .then(() => onFinish());
    //   })
    //   .catch((e) => {
    //     console.error(e);
    //   });
  }

  // TODO 类型混乱，需要优化
  // function assembleForm(): Pipeline {
  //   console.log('basicForm:', basicForm.getFieldsValue());
  //   console.log('aiForm:', aiForm.getFieldsValue());
  //   console.log('triggerForm:', triggerForm.getFieldsValue());
  //   console.log('safetyForm:', safetyForm.getFieldsValue());
  //   console.log('outputForm:', outputForm.getFieldsValue());
  //   const config: object = {
  //     ai: aiForm.getFieldsValue(),
  //     trigger: triggerForm.getFieldsValue(),
  //     safety: safetyForm.getFieldsValue(),
  //     output: outputForm.getFieldsValue(),
  //   };

  //   return {
  //     config,
  //     created_at: '',
  //     description: basicForm.getFieldsValue().description,
  //     for_version: '',
  //     name: basicForm.getFieldsValue().name,
  //     stages: [],
  //     updated_at: '',
  //     uuid: UUID.generate(),
  //   };
  // }

  return (
    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>

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
            <h1>{formLabel.label}</h1>
            <div>name: {formLabel.name}</div>
            
          </TabsContent>
        ))}
      </Tabs>


      {/* <div className={`${styles.changeFormButtonGroupContainer}`}>
        <Button
          type="primary"
          icon={<CaretLeftOutlined />}
          onClick={reduceFormLabelIndex}
          disabled={!getPreFormLabel()}
        >
          {getPreFormLabel()?.label || '暂无更多'}
        </Button>
        <Button
          type="primary"
          icon={<CaretRightOutlined />}
          onClick={addFormLabelIndex}
          disabled={!getNextFormLabel()}
          iconPosition={'end'}
        >
          {getNextFormLabel()?.label || '暂无更多'}
        </Button>

        <Button type="primary" onClick={handleCommit}>
          提交
        </Button>
      </div> */}
    </div>
  );
}

interface FormLabel {
  label: string;
  name: string;
}
