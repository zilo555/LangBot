'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  MessageSquareText,
  Cpu,
  Info,
  RefreshCw,
  ChevronLeft,
  Cloud,
  HardDrive,
  Lock,
} from 'lucide-react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ModelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewMode = 'providers' | 'space' | 'local';

export default function ModelsDialog({
  open,
  onOpenChange,
}: ModelsDialogProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('providers');
  const [activeTab, setActiveTab] = useState<string>('llm');

  // User account type
  const [accountType, setAccountType] = useState<'local' | 'space'>('local');

  // Local models
  const [localLLMList, setLocalLLMList] = useState<LLMCardVO[]>([]);
  const [localEmbeddingList, setLocalEmbeddingList] = useState<
    EmbeddingCardVO[]
  >([]);

  // Space models
  const [spaceLLMList, setSpaceLLMList] = useState<LLMCardVO[]>([]);
  const [spaceEmbeddingList, setSpaceEmbeddingList] = useState<
    EmbeddingCardVO[]
  >([]);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Form modals
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [isEditForm, setIsEditForm] = useState(false);
  const [nowSelectedLLM, setNowSelectedLLM] = useState<LLMCardVO | null>(null);
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState<boolean>(false);
  const [isEditEmbeddingForm, setIsEditEmbeddingForm] = useState(false);
  const [nowSelectedEmbedding, setNowSelectedEmbedding] =
    useState<EmbeddingCardVO | null>(null);

  // Requester name lists for display
  const [llmRequesterNameList, setLLMRequesterNameList] = useState<
    { label: string; value: string }[]
  >([]);
  const [embeddingRequesterNameList, setEmbeddingRequesterNameList] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    if (open) {
      loadUserInfo();
      loadRequesterLists();
      loadAllModels();
    }
  }, [open]);

  async function loadUserInfo() {
    try {
      const userInfo = await httpClient.getUserInfo();
      setAccountType(userInfo.account_type);
    } catch {
      // Default to local if user info cannot be fetched
      setAccountType('local');
    }
  }

  async function loadRequesterLists() {
    try {
      const llmRequesters = await httpClient.getProviderRequesters('llm');
      setLLMRequesterNameList(
        llmRequesters.requesters.map((item) => ({
          label: extractI18nObject(item.label),
          value: item.name,
        })),
      );

      const embeddingRequesters =
        await httpClient.getProviderRequesters('text-embedding');
      setEmbeddingRequesterNameList(
        embeddingRequesters.requesters.map((item) => ({
          label: extractI18nObject(item.label),
          value: item.name,
        })),
      );
    } catch (err) {
      console.error('Failed to load requester lists', err);
    }
  }

  async function loadAllModels() {
    await Promise.all([loadLLMModels(), loadEmbeddingModels()]);
  }

  async function loadLLMModels() {
    try {
      const resp = await httpClient.getProviderLLMModels();
      const localModels: LLMCardVO[] = [];
      const spaceModels: LLMCardVO[] = [];

      resp.models.forEach((model: LLMModel & { source?: string }) => {
        const cardVO = new LLMCardVO({
          id: model.uuid,
          iconURL: httpClient.getProviderRequesterIconURL(model.requester),
          name: model.name,
          providerLabel:
            llmRequesterNameList.find((item) => item.value === model.requester)
              ?.label || model.requester.substring(0, 10),
          baseURL: model.requester_config?.base_url,
          abilities: model.abilities || [],
        });

        if (model.source === 'space') {
          spaceModels.push(cardVO);
        } else {
          localModels.push(cardVO);
        }
      });

      setLocalLLMList(localModels);
      setSpaceLLMList(spaceModels);
    } catch (err) {
      console.error('Failed to load LLM models', err);
      toast.error(t('models.getModelListError') + (err as Error).message);
    }
  }

  async function loadEmbeddingModels() {
    try {
      const resp = await httpClient.getProviderEmbeddingModels();
      const localModels: EmbeddingCardVO[] = [];
      const spaceModels: EmbeddingCardVO[] = [];

      resp.models.forEach(
        (model: {
          uuid: string;
          requester: string;
          name: string;
          requester_config?: { base_url?: string };
          source?: string;
        }) => {
          const cardVO = new EmbeddingCardVO({
            id: model.uuid,
            iconURL: httpClient.getProviderRequesterIconURL(model.requester),
            name: model.name,
            providerLabel:
              embeddingRequesterNameList.find(
                (item) => item.value === model.requester,
              )?.label || model.requester.substring(0, 10),
            baseURL: model.requester_config?.base_url || '',
          });

          if (model.source === 'space') {
            spaceModels.push(cardVO);
          } else {
            localModels.push(cardVO);
          }
        },
      );

      setLocalEmbeddingList(localModels);
      setSpaceEmbeddingList(spaceModels);
    } catch (err) {
      console.error('Failed to load embedding models', err);
      toast.error(t('embedding.getModelListError') + (err as Error).message);
    }
  }

  async function handleSyncSpaceModels() {
    setIsSyncing(true);
    try {
      const stats = await httpClient.syncSpaceModels();
      toast.success(
        t('models.syncSuccess', {
          created: stats.created_llm + stats.created_embedding,
          updated: stats.updated_llm + stats.updated_embedding,
        }),
      );
      await loadAllModels();
    } catch (err) {
      toast.error(t('models.syncError') + (err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }

  function selectLLM(cardVO: LLMCardVO, isSpaceModel: boolean) {
    if (isSpaceModel) {
      // Space models are read-only, just show info
      toast.info(t('models.spaceModelReadOnly'));
      return;
    }
    setIsEditForm(true);
    setNowSelectedLLM(cardVO);
    setModalOpen(true);
  }

  function handleCreateModelClick() {
    setIsEditForm(false);
    setNowSelectedLLM(null);
    setModalOpen(true);
  }

  function selectEmbedding(cardVO: EmbeddingCardVO, isSpaceModel: boolean) {
    if (isSpaceModel) {
      toast.info(t('models.spaceModelReadOnly'));
      return;
    }
    setIsEditEmbeddingForm(true);
    setNowSelectedEmbedding(cardVO);
    setEmbeddingModalOpen(true);
  }

  function handleCreateEmbeddingModelClick() {
    setIsEditEmbeddingForm(false);
    setNowSelectedEmbedding(null);
    setEmbeddingModalOpen(true);
  }

  function renderProviderCards() {
    const isSpaceDisabled = accountType === 'local';

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
        {/* Space Provider Card */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            isSpaceDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={() => !isSpaceDisabled && setViewMode('space')}
        >
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Cloud className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>Space</CardTitle>
                {isSpaceDisabled && (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <CardDescription>
                {isSpaceDisabled
                  ? t('models.spaceDisabledForLocalAccount')
                  : t('models.spaceProviderDescription')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="secondary">{spaceLLMList.length} LLM</Badge>
              <Badge variant="secondary">
                {spaceEmbeddingList.length} Embedding
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Local Provider Card */}
        <Card
          className="cursor-pointer transition-all hover:shadow-lg"
          onClick={() => setViewMode('local')}
        >
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <HardDrive className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <CardTitle>{t('models.localProvider')}</CardTitle>
              <CardDescription>
                {t('models.localProviderDescription')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="secondary">{localLLMList.length} LLM</Badge>
              <Badge variant="secondary">
                {localEmbeddingList.length} Embedding
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderModelList(
    llmList: LLMCardVO[],
    embeddingList: EmbeddingCardVO[],
    isSpaceModel: boolean = false,
  ) {
    return (
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex flex-row justify-between items-center mb-2">
          <TabsList className="shadow-md py-5 bg-[#f0f0f0] dark:bg-[#2a2a2e]">
            <TabsTrigger value="llm" className="px-6 py-4 cursor-pointer">
              <MessageSquareText className="h-4 w-4 mr-1.5" />
              {t('llm.llmModels')}
            </TabsTrigger>
            <TabsTrigger value="embedding" className="px-6 py-4 cursor-pointer">
              <Cpu className="h-4 w-4 mr-1.5" />
              {t('embedding.embeddingModels')}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {isSpaceModel ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncSpaceModels}
                disabled={isSyncing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`}
                />
                {t('models.syncModels')}
              </Button>
            ) : (
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
            )}
          </div>
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
          {llmList.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              {isSpaceModel
                ? t('models.noSpaceModels')
                : t('models.noLocalModels')}
            </div>
          ) : (
            <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
              {llmList.map((cardVO) => (
                <div
                  key={cardVO.id}
                  onClick={() => selectLLM(cardVO, isSpaceModel)}
                  className={isSpaceModel ? 'cursor-default' : 'cursor-pointer'}
                >
                  <LLMCard cardVO={cardVO} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="embedding" className="flex-1 overflow-auto mt-0">
          {embeddingList.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              {isSpaceModel
                ? t('models.noSpaceModels')
                : t('models.noLocalModels')}
            </div>
          ) : (
            <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
              {embeddingList.map((cardVO) => (
                <div
                  key={cardVO.id}
                  onClick={() => selectEmbedding(cardVO, isSpaceModel)}
                  className={isSpaceModel ? 'cursor-default' : 'cursor-pointer'}
                >
                  <EmbeddingCard cardVO={cardVO} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    );
  }

  function getDialogTitle() {
    switch (viewMode) {
      case 'space':
        return 'Space ' + t('models.title');
      case 'local':
        return t('models.localProvider') + ' ' + t('models.title');
      default:
        return t('models.title');
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && (modalOpen || embeddingModalOpen)) {
            return;
          }
          if (!newOpen) {
            setViewMode('providers');
          }
          onOpenChange(newOpen);
        }}
      >
        <DialogContent className="overflow-hidden p-0 !max-w-[80vw] h-[75vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center gap-2">
              {viewMode !== 'providers' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('providers')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle>{getDialogTitle()}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6 pb-6 mt-4">
            {viewMode === 'providers' && renderProviderCards()}
            {viewMode === 'space' &&
              renderModelList(spaceLLMList, spaceEmbeddingList, true)}
            {viewMode === 'local' &&
              renderModelList(localLLMList, localEmbeddingList, false)}
          </div>
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
              loadAllModels();
            }}
            onFormCancel={() => {
              setModalOpen(false);
            }}
            onLLMDeleted={() => {
              setModalOpen(false);
              loadAllModels();
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
              loadAllModels();
            }}
            onFormCancel={() => {
              setEmbeddingModalOpen(false);
            }}
            onEmbeddingDeleted={() => {
              setEmbeddingModalOpen(false);
              loadAllModels();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
