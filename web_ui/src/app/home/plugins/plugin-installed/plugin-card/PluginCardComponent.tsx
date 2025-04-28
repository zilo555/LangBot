import styles from "./pluginCard.module.css"
import {PluginCardVO} from "@/app/home/plugins/plugin-installed/PluginCardVO";
import {GithubOutlined, LinkOutlined, ToolOutlined} from '@ant-design/icons';
import {Switch, Tag} from 'antd'
import {useState} from "react";
import {httpClient} from "@/app/infra/http/HttpClient";

export default function PluginCardComponent({
    cardVO
}: {
    cardVO: PluginCardVO
}) {
    const [initialized, setInitialized] = useState(cardVO.isInitialized)
    const [switchEnable, setSwitchEnable] = useState(true)

    function handleEnable() {
        setSwitchEnable(false)
        httpClient.togglePlugin(cardVO.author, cardVO.name, !initialized).then(result => {
            setInitialized(!initialized)
        }).catch(err => {
            console.log("error: ", err)
        }).finally(() => {
            setSwitchEnable(true)
        })
    }
    return (
        <div className={`${styles.cardContainer}`}>
            {/*  header  */}
            <div className={`${styles.cardHeader}`}>
                {/* left author */}
                <div className={`${styles.fontGray}`}>{cardVO.author}</div>
                {/*  right icon & version  */}
                <div className={`${styles.iconVersionContainer}`}>
                    <GithubOutlined
                        style={{fontSize: '26px'}}
                        type="setting"
                    />
                    <Tag color="#108ee9">v{cardVO.version}</Tag>
                </div>
            </div>
            {/*  content  */}
            <div className={`${styles.cardContent}`}>
                <div className={`${styles.boldFont}`}>{cardVO.name}</div>
                <div className={`${styles.fontGray}`}>{cardVO.description}</div>
            </div>
            {/*  footer  */}
            <div className={`${styles.cardFooter}`}>
                <div className={`${styles.linkSettingContainer}`}>
                    <div className={`${styles.link}`}>
                        <LinkOutlined
                            style={{fontSize: '22px'}}
                        />
                        <span>1</span>
                    </div>
                    <ToolOutlined
                        style={{fontSize: '22px'}}
                    />
                </div>

                <Switch
                    value={initialized}
                    onClick={handleEnable}
                    disabled={!switchEnable}
                />
            </div>
        </div>
    );
}
