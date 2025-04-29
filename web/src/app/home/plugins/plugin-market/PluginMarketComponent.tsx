"use client";

import { useEffect, useState } from "react";
import styles from "@/app/home/plugins/plugins.module.css";
import { PluginMarketCardVO } from "@/app/home/plugins/plugin-market/plugin-market-card/PluginMarketCardVO";
import PluginMarketCardComponent from "@/app/home/plugins/plugin-market/plugin-market-card/PluginMarketCardComponent";
import { Input, Pagination } from "antd";
import { spaceClient } from "@/app/infra/http/HttpClient";

export default function PluginMarketComponent() {
    const [marketPluginList, setMarketPluginList] = useState<
        PluginMarketCardVO[]
    >([]);
    const [totalCount, setTotalCount] = useState(0);
    const [nowPage, setNowPage] = useState(1);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [loading, setLoading] = useState(false);
    const pageSize = 10;

    useEffect(() => {
        initData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function initData() {
        getPluginList();
    }

    function onInputSearchKeyword(keyword: string) {
        // 这里记得加防抖，暂时没加
        setSearchKeyword(keyword);
        setNowPage(1);
        getPluginList(1, keyword);
    }

    function getPluginList(
        page: number = nowPage,
        keyword: string = searchKeyword
    ) {
        setLoading(true);
        spaceClient.getMarketPlugins(page, pageSize, keyword).then((res) => {
            setMarketPluginList(
                res.plugins.map(
                    (marketPlugin) =>
                        new PluginMarketCardVO({
                            author: marketPlugin.author,
                            description: marketPlugin.description,
                            githubURL: marketPlugin.repository,
                            name: marketPlugin.name,
                            pluginId: String(marketPlugin.ID),
                            starCount: marketPlugin.stars,
                            version: "version" in marketPlugin ? String(marketPlugin.version) : "1.0.0", // Default version if not provided
                        })
                )
            );
            setTotalCount(res.total);
            setLoading(false);
            console.log("market plugins:", res);
        }).catch(error => {
            console.error("获取插件列表失败:", error);
            setLoading(false);
        });
    }

    function handlePageChange(page: number) {
        setNowPage(page);
        getPluginList(page);
    }

    return (
        <div className={`${styles.marketComponentBody}`}>
            <Input
                style={{
                    width: '300px',
                    marginBottom: '10px',
                }}
                value={searchKeyword}
                placeholder="搜索插件"
                onChange={(e) => onInputSearchKeyword(e.target.value)}
            />
            <div className={`${styles.pluginListContainer}`}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
                ) : marketPluginList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>没有找到匹配的插件</div>
                ) : (
                    marketPluginList.map((vo, index) => (
                        <div key={`${vo.pluginId}-${index}`}>
                            <PluginMarketCardComponent cardVO={vo} />
                        </div>
                    ))
                )}
            </div>
            {totalCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '20px' }}>
                    <Pagination
                        current={nowPage}
                        total={totalCount}
                        pageSize={pageSize}
                        onChange={handlePageChange}
                        showSizeChanger={false}
                    />
                </div>
            )}
        </div>
    )
}
