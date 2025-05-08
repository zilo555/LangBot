'use client';

import { useState, useEffect } from 'react';
import { LLMCardVO } from '@/app/home/models/component/llm-card/LLMCardVO';
import styles from './LLMConfig.module.css';
import EmptyAndCreateComponent from '@/app/home/components/empty-and-create-component/EmptyAndCreateComponent';
import LLMCard from '@/app/home/models/component/llm-card/LLMCard';
import LLMForm from '@/app/home/models/component/llm-form/LLMForm';
import CreateCardComponent from '@/app/infra/basic-component/create-card-component/CreateCardComponent';
import { httpClient } from '@/app/infra/http/HttpClient';
import { LLMModel } from '@/app/infra/entities/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


export default function LLMConfigPage() {
  const [cardList, setCardList] = useState<LLMCardVO[]>([]);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [isEditForm, setIsEditForm] = useState(false);
  const [nowSelectedLLM, setNowSelectedLLM] = useState<LLMCardVO | null>(null);

  useEffect(() => {
    getLLMModelList();
  }, []);

  async function getLLMModelList() {
    const requesterNameListResp = await httpClient.getProviderRequesters();
    const requesterNameList = requesterNameListResp.requesters.map((item) => {
      return {
        label: item.label.zh_CN,
        value: item.name,
      };
    });

    httpClient
      .getProviderLLMModels()
      .then((resp) => {
        const llmModelList: LLMCardVO[] = resp.models.map((model: LLMModel) => {
          console.log('model', model);
          return new LLMCardVO({
            id: model.uuid,
            iconURL: httpClient.getProviderRequesterIconURL(model.requester),
            name: model.name,
            providerLabel: requesterNameList.find((item) => item.value === model.requester)?.label || model.requester.substring(0, 10),
            baseURL: model.requester_config?.base_url,
            abilities: model.abilities || [],
          });
        });
        console.log('get llmModelList', llmModelList);
        setCardList(llmModelList);
      })
      .catch((err) => {
        // TODO error toast
        console.error('get LLM model list error', err);
      });
  }

  function selectLLM(cardVO: LLMCardVO) {
    setIsEditForm(true);
    setNowSelectedLLM(cardVO);
    console.log('set now vo', cardVO);
    setModalOpen(true);
  }
  function handleCreateModelClick() {
    setIsEditForm(false);
    setNowSelectedLLM(null);
    setModalOpen(true);
  }

  return (
    <div >

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[700px] p-6">
          <DialogHeader>
            <DialogTitle>{isEditForm ? '预览模型' : '创建模型'}</DialogTitle>
          </DialogHeader>
          <LLMForm
            editMode={isEditForm}
            initLLMId={nowSelectedLLM?.id}
            onFormSubmit={() => {
              setModalOpen(false);
              getLLMModelList();
            }}
            onFormCancel={() => {
              setModalOpen(false);
            }}
            onLLMDeleted={() => {
              setModalOpen(false);
              getLLMModelList();
            }}
          />
        </DialogContent>
      </Dialog>
      <div className={`${styles.modelListContainer}`}>

        <CreateCardComponent
          width={'24rem'}
          height={'10rem'}
          plusSize={'90px'}
          onClick={handleCreateModelClick}
        />
        {cardList.map((cardVO) => {
          return (
            <div
              key={cardVO.id}
              onClick={() => {
                selectLLM(cardVO);
              }}
            >
              <LLMCard cardVO={cardVO}></LLMCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}
