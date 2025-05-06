'use client';

import { useEffect, useState } from 'react';
import styles from './botConfig.module.css';
import EmptyAndCreateComponent from '@/app/home/components/empty-and-create-component/EmptyAndCreateComponent';
import { useRouter } from 'next/navigation';
import { BotCardVO } from '@/app/home/bots/components/bot-card/BotCardVO';
import { Modal, notification, Spin } from 'antd';
import BotForm from '@/app/home/bots/components/bot-form/BotForm';
import BotCard from '@/app/home/bots/components/bot-card/BotCard';
import CreateCardComponent from '@/app/infra/basic-component/create-card-component/CreateCardComponent';
import { httpClient } from '@/app/infra/http/HttpClient';
import { Bot, Adapter } from '@/app/infra/api/api-types';

export default function BotConfigPage() {
  const router = useRouter();
  const [pageShowRule, setPageShowRule] = useState<BotConfigPageShowRule>(
    BotConfigPageShowRule.NO_BOT,
  );
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [botList, setBotList] = useState<BotCardVO[]>([]);
  const [isEditForm, setIsEditForm] = useState(false);
  const [nowSelectedBotCard, setNowSelectedBotCard] = useState<BotCardVO>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // TODO：补齐加载转圈逻辑
    setIsLoading(true);
    checkHasLLM().then((hasLLM) => {
      if (hasLLM) {
        getBotList();
      } else {
        setPageShowRule(BotConfigPageShowRule.NO_LLM);
        setIsLoading(false);
      }
    });
  }, []);

  async function checkHasLLM(): Promise<boolean> {
    // NOT IMPL
    return true;
  }

  async function getBotList() {
    setIsLoading(true);

    const adapterListResp = await httpClient.getAdapters();
    const adapterList = adapterListResp.adapters.map((adapter: Adapter) => {
      return {
        label: adapter.label.zh_CN,
        value: adapter.name,
      };
    });

    httpClient
      .getBots()
      .then((resp) => {
        const botList: BotCardVO[] = resp.bots.map((bot: Bot) => {
          return new BotCardVO({
            id: bot.uuid || '',
            iconURL: httpClient.getAdapterIconURL(bot.adapter),
            name: bot.name,
            description: bot.description,
            adapterLabel: adapterList.find((item) => item.value === bot.adapter)?.label || bot.adapter.substring(0, 10),
            usePipelineName: bot.use_pipeline_name || '',
          });
        });
        if (botList.length === 0) {
          setPageShowRule(BotConfigPageShowRule.NO_BOT);
        } else {
          setPageShowRule(BotConfigPageShowRule.HAVE_BOT);
        }
        setBotList(botList);
      })
      .catch((err) => {
        console.error('get bot list error', err);
        // TODO HACK: need refactor to hook mode Notification, but it's not working under render
        notification.error({
          message: '获取机器人列表失败',
          description: err.message,
          placement: 'bottomRight',
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function handleCreateBotClick() {
    setIsEditForm(false);
    setNowSelectedCard(undefined);
    setModalOpen(true);
  }

  function setNowSelectedCard(cardVO: BotCardVO | undefined) {
    setNowSelectedBotCard(cardVO);
  }

  function selectBot(cardVO: BotCardVO) {
    setIsEditForm(true);
    setNowSelectedCard(cardVO);
    console.log('set now vo', cardVO);
    setModalOpen(true);
  }

  return (
    <div className={styles.configPageContainer}>
      <Spin spinning={isLoading} tip="加载中..." size="large">
        <Modal
          title={isEditForm ? '编辑机器人' : '创建机器人'}
          centered
          open={modalOpen}
          onOk={() => setModalOpen(false)}
          onCancel={() => setModalOpen(false)}
          width={700}
          footer={null}
          destroyOnClose={true}
        >
          <BotForm
            initBotId={nowSelectedBotCard?.id}
            onFormSubmit={() => {
              getBotList();
              setModalOpen(false);
            }}
            onFormCancel={() => setModalOpen(false)}
          />
        </Modal>
        {pageShowRule === BotConfigPageShowRule.NO_LLM && (
          <EmptyAndCreateComponent
            title={'需要先创建大模型才能配置机器人哦～'}
            subTitle={'快去创建一个吧！'}
            buttonText={'创建大模型 GO！'}
            onButtonClick={() => {
              router.push('/home/models');
            }}
          />
        )}

        {pageShowRule === BotConfigPageShowRule.NO_BOT && (
          <EmptyAndCreateComponent
            title={'您还未配置机器人哦～'}
            subTitle={'快去创建一个吧！'}
            buttonText={'创建机器人 +'}
            onButtonClick={handleCreateBotClick}
          />
        )}
      </Spin>
      {/* 注意：其余的返回内容需要保持在Spin组件外部 */}
      {pageShowRule === BotConfigPageShowRule.HAVE_BOT && (
        <div className={`${styles.botListContainer}`}>

          <CreateCardComponent
            height={'10rem'}
            plusSize={'4rem'}
            onClick={handleCreateBotClick}
          />
          {botList.map((cardVO) => {
            return (
              <div
                key={cardVO.id}
                onClick={() => {
                  selectBot(cardVO);
                }}
              >
                <BotCard botCardVO={cardVO} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

enum BotConfigPageShowRule {
  NO_LLM,
  NO_BOT,
  HAVE_BOT,
}
