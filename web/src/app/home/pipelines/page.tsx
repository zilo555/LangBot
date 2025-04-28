"use client";
import { Modal } from "antd";
import { useState, useEffect } from "react";
import CreateCardComponent from "@/app/infra/basic-component/create-card-component/CreateCardComponent";
import PipelineFormComponent from "./components/pipeline-form/PipelineFormComponent";
import { httpClient } from "@/app/infra/http/HttpClient";
import { PipelineCardVO } from "@/app/home/pipelines/components/pipeline-card/PipelineCardVO";
import PipelineCardComponent from "@/app/home/pipelines/components/pipeline-card/PipelineCardComponent";

export default function PluginConfigPage() {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [isEditForm] = useState(false);
  const [pipelineList, setPipelineList] = useState<PipelineCardVO[]>([]);

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
            version: pipeline.for_version
          });
        });
        setPipelineList(pipelineList);
      })
      .catch((error) => {
        // TODO toast
        console.log(error);
      });
  }

  return (
    <div className={``}>
      <Modal
        title={isEditForm ? "编辑流水线" : "创建流水线"}
        centered
        open={modalOpen}
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
        />
      </Modal>

      {pipelineList.length > 0 && (
        <div className={``}>
          {pipelineList.map((pipeline) => {
            return (
              <PipelineCardComponent key={pipeline.id} cardVO={pipeline} />
            );
          })}
        </div>
      )}
      <CreateCardComponent
        width={360}
        height={200}
        plusSize={90}
        onClick={() => {
          setModalOpen(true);
        }}
      />
    </div>
  );
}
