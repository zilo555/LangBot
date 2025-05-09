import { useState, useEffect } from 'react';
import { ApiRespPlugin, ApiRespPluginConfig, Plugin } from '@/app/infra/entities/api';
import { httpClient } from '@/app/infra/http/HttpClient';
import DynamicFormComponent from '@/app/home/components/dynamic-form/DynamicFormComponent';
import { IDynamicFormItemSchema } from '@/app/infra/entities/form/dynamic';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function PluginForm({
  pluginAuthor,
  pluginName,
  onFormSubmit,
  onFormCancel,
}: {
  pluginAuthor: string;
  pluginName: string;
  onFormSubmit: () => void;
  onFormCancel: () => void;
}) {
  const [pluginInfo, setPluginInfo] = useState<Plugin>();
  const [pluginConfig, setPluginConfig] = useState<ApiRespPluginConfig>();
  const [isSaving, setIsLoading] = useState(false);

  useEffect(() => {
    // 获取插件信息
    httpClient.getPlugin(pluginAuthor, pluginName).then((res) => {
      setPluginInfo(res.plugin);
    });
    // 获取插件配置
    httpClient.getPluginConfig(pluginAuthor, pluginName).then((res) => {
      setPluginConfig(res);
    });
  }, [pluginAuthor, pluginName]);

  const handleSubmit = async (values: object) => {
    setIsLoading(true);
    try {
      await httpClient.updatePluginConfig(pluginAuthor, pluginName, values);
      onFormSubmit();
    } catch (error) {
      console.error('更新插件配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!pluginInfo || !pluginConfig) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="space-y-2">
        <div className="text-lg font-medium">{pluginInfo.name}</div>
        <div className="text-sm text-gray-500 pb-2">
          {pluginInfo.description.zh_CN}
        </div>
        {pluginInfo.config_schema.length > 0 && (
          <DynamicFormComponent
            itemConfigList={pluginInfo.config_schema}
            initialValues={pluginConfig.config}
          onSubmit={(values) => {
            let config = pluginConfig.config;
            config = {
              ...config,
              ...values,
            };
            setPluginConfig({
                config: config,
              });
            }}
          />
        )}
        {pluginInfo.config_schema.length === 0 && (
          <div className="text-sm text-gray-500">
            该插件没有配置项。
          </div>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 bg-background border-t p-4 mt-4">
        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            onClick={() => handleSubmit(pluginConfig.config)}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存配置'}
          </Button>
          <Button type="button" variant="outline" onClick={onFormCancel}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}