'use client';
import PluginInstalledComponent from '@/app/home/plugins/plugin-installed/PluginInstalledComponent';
import PluginMarketComponent from '@/app/home/plugins/plugin-market/PluginMarketComponent';
import styles from './plugins.module.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

export default function PluginConfigPage() {
  return (
    <div className={styles.pageContainer}>
      <Tabs defaultValue="installed" className="w-full">
        <div className='flex flex-row justify-between items-center'>
          <TabsList className='shadow-md py-5 bg-[#f0f0f0]'>
            <TabsTrigger value="installed" className="px-6 py-4">已安装</TabsTrigger>
            <TabsTrigger value="market" className="px-6 py-4">插件市场</TabsTrigger>

          </TabsList>

          <div className='flex flex-row justify-end items-center'>
            <Button variant="default" className='px-6 py-4'>
              <PlusIcon className='w-4 h-4' />
              安装
            </Button>
          </div>
        </div>
        <TabsContent value="installed">
          <PluginInstalledComponent />
        </TabsContent>
        <TabsContent value="market">
          <PluginMarketComponent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
