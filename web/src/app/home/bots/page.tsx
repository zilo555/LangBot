'use client';

import { useEffect, useState } from 'react';
import styles from './botConfig.module.css';
import EmptyAndCreateComponent from '@/app/home/components/empty-and-create-component/EmptyAndCreateComponent';
import { useRouter } from 'next/navigation';
import { BotCardVO } from '@/app/home/bots/components/bot-card/BotCardVO';
import BotForm from '@/app/home/bots/components/bot-form/BotForm';
import BotCard from '@/app/home/bots/components/bot-card/BotCard';
import CreateCardComponent from '@/app/infra/basic-component/create-card-component/CreateCardComponent';
import { httpClient } from '@/app/infra/http/HttpClient';
import { Bot, Adapter } from '@/app/infra/api/api-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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
        // notification.error({
        //   message: '获取机器人列表失败',
        //   description: err.message,
        //   placement: 'bottomRight',
        // });
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[700px] max-h-[80vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{isEditForm ? '编辑机器人' : '创建机器人'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <BotForm
              initBotId={nowSelectedBotCard?.id}
              onFormSubmit={() => {
                getBotList();
                setModalOpen(false);
              }}
              onFormCancel={() => setModalOpen(false)}
              onBotDeleted={() => {
                getBotList();
                setModalOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 注意：其余的返回内容需要保持在Spin组件外部 */}
      {pageShowRule === BotConfigPageShowRule.HAVE_BOT && (
        <div className={`${styles.botListContainer}`}>

          <CreateCardComponent
            width={'24rem'}
            height={'10rem'}
            plusSize={'90px'}
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
