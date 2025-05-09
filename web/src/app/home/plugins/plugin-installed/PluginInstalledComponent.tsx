'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import CreateCardComponent from '@/app/infra/basic-component/create-card-component/CreateCardComponent';
import { PluginCardVO } from '@/app/home/plugins/plugin-installed/PluginCardVO';
import PluginCardComponent from '@/app/home/plugins/plugin-installed/plugin-card/PluginCardComponent';
import styles from '@/app/home/plugins/plugins.module.css';
import { GithubIcon } from 'lucide-react';
import { httpClient } from '@/app/infra/http/HttpClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface PluginInstalledComponentRef {
  refreshPluginList: () => void;
}

const PluginInstalledComponent = forwardRef<PluginInstalledComponentRef>((props, ref) => {
  const [pluginList, setPluginList] = useState<PluginCardVO[]>([]);

  useEffect(() => {
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initData() {
    getPluginList();
  }

  function getPluginList() {
    httpClient.getPlugins().then((value) => {
      setPluginList(
        value.plugins.map((plugin) => {
          return new PluginCardVO({
            author: plugin.author,
            description: plugin.description.zh_CN,
            enabled: plugin.enabled,
            name: plugin.name,
            version: plugin.version,
            status: plugin.status,
            tools: plugin.tools,
            event_handlers: plugin.event_handlers,
            repository: plugin.repository,
            priority: plugin.priority,
          });
        }),
      );
    });
  }

  useImperativeHandle(ref, () => ({
    refreshPluginList: getPluginList
  }));
  
  return (
    <div className={`${styles.pluginListContainer}`}>
      
      {pluginList.map((vo, index) => {
        return (
          <div key={index}>
            <PluginCardComponent cardVO={vo} />
          </div>
        );
      })}
    </div>
  );
});

export default PluginInstalledComponent;
