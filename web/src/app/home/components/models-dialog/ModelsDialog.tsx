'use client';

import { useState, useEffect } from 'react';
import { Plus, MessageSquareText, Cpu, Info } from 'lucide-react';
import { LLMCardVO } from './component/llm-card/LLMCardVO';
import LLMCard from './component/llm-card/LLMCard';
import LLMForm from './component/llm-form/LLMForm';
import { httpClient } from '@/app/infra/http/HttpClient';
import { LLMModel } from '@/app/infra/entities/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { extractI18nObject } from '@/i18n/I18nProvider';
import { EmbeddingCardVO } from './component/embedding-card/EmbeddingCardVO';
import EmbeddingCard from './component/embedding-card/EmbeddingCard';
import EmbeddingForm from './component/embedding-form/EmbeddingForm';

interface ModelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ModelsDialog({
  open,
  onOpenChange,
}: ModelsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('llm');
  const [cardList, setCardList] = useState<LLMCardVO[]>([]);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [isEditForm, setIsEditForm] = useState(false);
  const [nowSelectedLLM, setNowSelectedLLM] = useState<LLMCardVO | null>(null);
  const [embeddingCardList, setEmbeddingCardList] = useState<EmbeddingCardVO[]>(
    [],
  );
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState<boolean>(false);
  const [isEditEmbeddingForm, setIsEditEmbeddingForm] = useState(false);
  const [nowSelectedEmbedding, setNowSelectedEmbedding] =
    useState<EmbeddingCardVO | null>(null);

  useEffect(() => {
    if (open) {
      getLLMModelList();
      getEmbeddingModelList();
    }
  }, [open]);

  async function getLLMModelList() {
    const requesterNameListResp = await httpClient.getProviderRequesters('llm');
    const requesterNameList = requesterNameListResp.requesters.map((item) => {
      return {
        label: extractI18nObject(item.label),
        value: item.name,
      };
    });

    httpClient
      .getProviderLLMModels()
      .then((resp) => {
        const llmModelList: LLMCardVO[] = resp.models.map((model: LLMModel) => {
          return new LLMCardVO({
            id: model.uuid,
            iconURL: httpClient.getProviderRequesterIconURL(model.requester),
            name: model.name,
            providerLabel:
              requesterNameList.find((item) => item.value === model.requester)
                ?.label || model.requester.substring(0, 10),
            baseURL: model.requester_config?.base_url,
            abilities: model.abilities || [],
          });
        });
        setCardList(llmModelList);
      })
      .catch((err) => {
        console.error('get LLM model list error', err);
        toast.error(t('models.getModelListError') + err.message);
      });
  }

  function selectLLM(cardVO: LLMCardVO) {
    setIsEditForm(true);
    setNowSelectedLLM(cardVO);
    setModalOpen(true);
  }
  function handleCreateModelClick() {
    setIsEditForm(false);
    setNowSelectedLLM(null);
    setModalOpen(true);
  }
  function selectEmbedding(cardVO: EmbeddingCardVO) {
    setIsEditEmbeddingForm(true);
    setNowSelectedEmbedding(cardVO);
    setEmbeddingModalOpen(true);
  }

  function handleCreateEmbeddingModelClick() {
    setIsEditEmbeddingForm(false);
    setNowSelectedEmbedding(null);
    setEmbeddingModalOpen(true);
  }
  async function getEmbeddingModelList() {
    const requesterNameListResp =
      await httpClient.getProviderRequesters('text-embedding');
    const requesterNameList = requesterNameListResp.requesters.map((item) => {
      return {
        label: extractI18nObject(item.label),
        value: item.name,
      };
    });

    httpClient
      .getProviderEmbeddingModels()
      .then((resp) => {
        const embeddingModelList: EmbeddingCardVO[] = resp.models.map(
          (model: {
            uuid: string;
            requester: string;
            name: string;
            requester_config?: { base_url?: string };
          }) => {
            return new EmbeddingCardVO({
              id: model.uuid,
              iconURL: httpClient.getProviderRequesterIconURL(model.requester),
              name: model.name,
              providerLabel:
                requesterNameList.find((item) => item.value === model.requester)
                  ?.label || model.requester.substring(0, 10),
              baseURL: model.requester_config?.base_url || '',
            });
          },
        );
        setEmbeddingCardList(embeddingModelList);
      })
      .catch((err) => {
        console.error('get Embedding model list error', err);
        toast.error(t('embedding.getModelListError') + err.message);
      });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && (modalOpen || embeddingModalOpen)) {
            return;
          }
          onOpenChange(newOpen);
        }}
      >
        <DialogContent className="overflow-hidden p-0 !max-w-[80vw] h-[75vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>{t('models.title')}</DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full flex-1 flex flex-col overflow-hidden px-6 pb-6"
          >
            <div className="flex flex-row justify-between items-center mb-2 mt-4">
              <TabsList className="shadow-md py-5 bg-[#f0f0f0] dark:bg-[#2a2a2e]">
                <TabsTrigger value="llm" className="px-6 py-4 cursor-pointer">
                  <MessageSquareText className="h-4 w-4 mr-1.5" />
                  {t('llm.llmModels')}
                </TabsTrigger>
                <TabsTrigger
                  value="embedding"
                  className="px-6 py-4 cursor-pointer"
                >
                  <Cpu className="h-4 w-4 mr-1.5" />
                  {t('embedding.embeddingModels')}
                </TabsTrigger>
              </TabsList>
              <Button
                size="sm"
                onClick={
                  activeTab === 'llm'
                    ? handleCreateModelClick
                    : handleCreateEmbeddingModelClick
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {activeTab === 'llm'
                  ? t('models.createModel')
                  : t('embedding.createModel')}
              </Button>
            </div>

            <div className="mb-3 flex items-center">
              <Info className="h-4 w-4 mr-1.5 text-muted-foreground" />
              {activeTab === 'llm' ? (
                <p className="text-sm text-muted-foreground flex items-center">
                  {t('llm.description')}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center">
                  {t('embedding.description')}
                </p>
              )}
            </div>

            <TabsContent value="llm" className="flex-1 overflow-auto mt-0">
              <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
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
            </TabsContent>

            <TabsContent
              value="embedding"
              className="flex-1 overflow-auto mt-0"
            >
              <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
                {embeddingCardList.map((cardVO) => {
                  return (
                    <div
                      key={cardVO.id}
                      onClick={() => {
                        selectEmbedding(cardVO);
                      }}
                    >
                      <EmbeddingCard cardVO={cardVO}></EmbeddingCard>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[700px] p-6">
          <DialogHeader>
            <DialogTitle>
              {isEditForm ? t('models.editModel') : t('models.createModel')}
            </DialogTitle>
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

      <Dialog open={embeddingModalOpen} onOpenChange={setEmbeddingModalOpen}>
        <DialogContent className="w-[700px] p-6">
          <DialogHeader>
            <DialogTitle>
              {isEditEmbeddingForm
                ? t('embedding.editModel')
                : t('embedding.createModel')}
            </DialogTitle>
          </DialogHeader>
          <EmbeddingForm
            editMode={isEditEmbeddingForm}
            initEmbeddingId={nowSelectedEmbedding?.id}
            onFormSubmit={() => {
              setEmbeddingModalOpen(false);
              getEmbeddingModelList();
            }}
            onFormCancel={() => {
              setEmbeddingModalOpen(false);
            }}
            onEmbeddingDeleted={() => {
              setEmbeddingModalOpen(false);
              getEmbeddingModelList();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
