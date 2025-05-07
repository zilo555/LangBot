'use client';
import { Modal } from 'antd';
import { useState, useEffect } from 'react';
import CreateCardComponent from '@/app/infra/basic-component/create-card-component/CreateCardComponent';
import PipelineFormComponent from './components/pipeline-form/PipelineFormComponent';
import { httpClient } from '@/app/infra/http/HttpClient';
import { PipelineCardVO } from '@/app/home/pipelines/components/pipeline-card/PipelineCardVO';
import PipelineCard from '@/app/home/pipelines/components/pipeline-card/PipelineCard';
import { PipelineFormEntity } from '@/app/home/pipelines/components/pipeline-form/PipelineFormEntity';
import styles from './pipelineConfig.module.css';

export default function PluginConfigPage() {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [isEditForm, setIsEditForm] = useState(false);
  const [pipelineList, setPipelineList] = useState<PipelineCardVO[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedPipelineFormValue, setSelectedPipelineFormValue] =
    useState<PipelineFormEntity>({
      basic: {},
      ai: {},
      trigger: {},
      safety: {},
      output: {},
    });
  const [disableForm, setDisableForm] = useState(false);

  useEffect(() => {
    getPipelines();
  }, []);

  function getPipelines() {
    httpClient
      .getPipelines()
      .then((value) => {
        let currentTime = new Date();
        const pipelineList = value.pipelines.map((pipeline) => {
          let lastUpdatedTimeAgo = Math.floor((currentTime.getTime() - new Date(pipeline.updated_at).getTime()) / 1000 / 60 / 60 / 24);
          
          let lastUpdatedTimeAgoText = lastUpdatedTimeAgo > 0 ? ` ${lastUpdatedTimeAgo} 天前` : '今天';
          
          return new PipelineCardVO({
            lastUpdatedTimeAgo: lastUpdatedTimeAgoText,
            description: pipeline.description,
            id: pipeline.uuid,
            name: pipeline.name,
            isDefault: pipeline.is_default,
          });
        });
        setPipelineList(pipelineList);
      })
      .catch((error) => {
        // TODO toast
        console.log(error);
      });
  }

  function getSelectedPipelineForm(id?: string) {
    httpClient.getPipeline(id ?? selectedPipelineId).then((value) => {
      setSelectedPipelineFormValue({
        ai: value.pipeline.config.ai,
        basic: {
          description: value.pipeline.description,
          name: value.pipeline.name,
        },
        output: value.pipeline.config.output,
        safety: value.pipeline.config.safety,
        trigger: value.pipeline.config.trigger,
      });
      setDisableForm(false);
    });
  }

  return (
    <div className={styles.configPageContainer}>
      <Modal
        title={isEditForm ? '编辑流水线' : '创建流水线'}
        centered
        open={modalOpen}
        destroyOnClose={true}
        onOk={() => setModalOpen(false)}
        onCancel={() => setModalOpen(false)}
        width={700}
        footer={null}
      >
        <PipelineFormComponent
          onFinish={() => {
            getPipelines();
            setModalOpen(false);
          }}
          isEditMode={isEditForm}
          pipelineId={selectedPipelineId}
          disableForm={disableForm}
          initValues={selectedPipelineFormValue}
        />
      </Modal>

      {pipelineList.length > 0 && (
        <div className={styles.pipelineListContainer}>
          <CreateCardComponent
            width={'24rem'}
            height={'10rem'}
            plusSize={'90px'}
            onClick={() => {
              setModalOpen(true);
            }}
          />

          {pipelineList.map((pipeline) => {
            return (
              <div
                key={pipeline.id}
                onClick={() => {
                  setDisableForm(true);
                  setIsEditForm(true);
                  setModalOpen(true);
                  setSelectedPipelineId(pipeline.id);
                  getSelectedPipelineForm(pipeline.id);
                }}
              >
                <PipelineCard cardVO={pipeline} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
