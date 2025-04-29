"use client"
import { Radio } from 'antd';
import { useState } from "react";
import PluginInstalledComponent from "@/app/home/plugins/plugin-installed/PluginInstalledComponent";
import PluginMarketComponent from "@/app/home/plugins/plugin-market/PluginMarketComponent";
import styles from './plugins.module.css'

export default function PluginConfigPage() {
    enum PageType {
        INSTALLED = "installed",
        MARKET = 'market'
    }

    const [nowPageType, setNowPageType] = useState(PageType.INSTALLED)

    return (
        <div className={styles.pageContainer}>
            <Radio.Group
                block
                options={[
                    { label: '已安装', value: PageType.INSTALLED },
                    { label: '插件市场', value: PageType.MARKET },
                ]}
                defaultValue={PageType.INSTALLED}
                value={nowPageType}
                optionType="button"
                buttonStyle="solid"
                style={{ marginBottom: '20px' }}
                onChange={(e) => {
                    setNowPageType(e.target.value as PageType)
                }}
            />

            {nowPageType === PageType.INSTALLED ? <PluginInstalledComponent /> : <PluginMarketComponent />}
        </div>
    );
}
