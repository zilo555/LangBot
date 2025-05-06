'use client';
import { Modal } from 'antd';
import { useState, useEffect } from 'react';
import CreateCardComponent from '@/app/infra/basic-component/create-card-component/CreateCardComponent';
import PipelineFormComponent from './components/pipeline-form/PipelineFormComponent';
import { httpClient } from '@/app/infra/http/HttpClient';
import { PipelineCardVO } from '@/app/home/pipelines/components/pipeline-card/PipelineCardVO';
import PipelineCardComponent from '@/app/home/pipelines/components/pipeline-card/PipelineCardComponent';
import { PipelineFormEntity } from '@/app/home/pipelines/components/pipeline-form/PipelineFormEntity';

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
        const pipelineList = value.pipelines.map((pipeline) => {
          return new PipelineCardVO({
            createTime: pipeline.created_at,
            description: pipeline.description,
            id: pipeline.uuid,
            name: pipeline.name,
            version: pipeline.for_version,
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
    <div className={``}>
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
        <div className={``}>
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
                <PipelineCardComponent cardVO={pipeline} />
              </div>
            );
          })}
        </div>
      )}
      <CreateCardComponent
        height={'200px'}
        plusSize={'90px'}
        onClick={() => {
          setModalOpen(true);
        }}
      />
    </div>
  );
}
