import { useEffect, useState } from 'react';
import { httpClient } from '@/app/infra/http/HttpClient';
import { KnowledgeBaseFile } from '@/app/infra/entities/api';
import { columns, DocumentFile } from './documents/columns';
import { DataTable } from './documents/data-table';
import FileUploadZone from './FileUploadZone';

export default function KBDoc({ kbId }: { kbId: string }) {
  const [documentsList, setDocumentsList] = useState<DocumentFile[]>([]);

  useEffect(() => {
    getDocumentsList();
  }, []);

  async function getDocumentsList() {
    const resp = await httpClient.getKnowledgeBaseFiles(kbId);
    setDocumentsList(
      resp.files.map((file: KnowledgeBaseFile) => {
        return {
          id: file.file_id,
          name: file.file_name,
          status: file.status,
        };
      }),
    );
  }

  const handleUploadSuccess = () => {
    // Refresh document list after successful upload
    getDocumentsList();
  };

  const handleUploadError = (error: string) => {
    // Error messages are already handled by toast in FileUploadZone component
    console.error('Upload failed:', error);
  };

  return (
    <div className="container mx-auto py-2">
      <FileUploadZone
        kbId={kbId}
        onUploadSuccess={handleUploadSuccess}
        onUploadError={handleUploadError}
      />
      <DataTable columns={columns()} data={documentsList} />
    </div>
  );
}
