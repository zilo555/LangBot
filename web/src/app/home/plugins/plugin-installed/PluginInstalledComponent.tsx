'use client';

import { useState, useEffect } from 'react';
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

export default function PluginInstalledComponent() {
  const [pluginList, setPluginList] = useState<PluginCardVO[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [githubURL, setGithubURL] = useState('');

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
            handlerCount: 0,
            name: plugin.name,
            version: plugin.version,
            isInitialized: plugin.status === 'initialized',
          });
        }),
      );
    });
  }

  function handleModalConfirm() {
    installPlugin(githubURL);
    setModalOpen(false);
  }

  function installPlugin(url: string) {
    httpClient
      .installPluginFromGithub(url)
      .then(() => {
        // 安装后重新拉取
        getPluginList();
      })
      .catch((err) => {
        console.log('error when install plugin:', err);
      });
  }
  
  return (
    <div className={`${styles.pluginListContainer}`}>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[500px] p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <GithubIcon className="size-6" />
              <span>从GitHub安装插件</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p className="mb-2">目前仅支持从 GitHub 安装</p>
            <Input
              placeholder="请输入插件的Github链接"
              value={githubURL}
              onChange={(e) => setGithubURL(e.target.value)}
              className="mb-4"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>取消</Button>
            <Button onClick={handleModalConfirm}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {pluginList.map((vo, index) => {
        return (
          <div key={index}>
            <PluginCardComponent cardVO={vo} />
          </div>
        );
      })}
      
      <CreateCardComponent
        height={'140px'}
        plusSize={'90px'}
        onClick={() => {
          setModalOpen(true);
        }}
      />
    </div>
  );
}
