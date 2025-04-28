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
    spaceClient.getMarketPlugins(page, 10, keyword).then((res) => {
      setMarketPluginList(
        res.plugins.map(
          (marketPlugin) =>
            new PluginMarketCardVO({
              author: marketPlugin.author,
              description: marketPlugin.description,
              githubURL: marketPlugin.repository,
              name: marketPlugin.name,
              pluginId: String(marketPlugin.ID),
              starCount: marketPlugin.stars
            })
        )
      );
      setTotalCount(res.total);
      console.log("market plugins:", res);
    });
  }

  return (
    <div className={`${styles.marketComponentBody}`}>
      <Input
        style={{
          width: "300px",
          marginTop: "10px"
        }}
        value={searchKeyword}
        placeholder="搜索插件"
        onChange={(e) => onInputSearchKeyword(e.target.value)}
      />
      <div className={`${styles.pluginListContainer}`}>
        {marketPluginList.map((vo, index) => {
          return (
            <div key={index}>
              <PluginMarketCardComponent cardVO={vo} />
            </div>
          );
        })}
      </div>
      <Pagination
        defaultCurrent={1}
        total={totalCount}
        onChange={(pageNumber) => {
          setNowPage(pageNumber);
          getPluginList(pageNumber);
        }}
      />
    </div>
  );
}
