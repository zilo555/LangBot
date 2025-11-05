import { I18nObject } from '@/app/infra/entities/common';

export interface IDynamicFormItemSchema {
  id: string;
  default: string | number | boolean | Array<unknown>;
  label: I18nObject;
  name: string;
  required: boolean;
  type: DynamicFormItemType;
  description?: I18nObject;
  options?: IDynamicFormItemOption[];
  accept?: string; // For file type: accepted MIME types
}

export enum DynamicFormItemType {
  INT = 'integer',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  STRING = 'string',
  TEXT = 'text',
  STRING_ARRAY = 'array[string]',
  FILE = 'file',
  FILE_ARRAY = 'array[file]',
  SELECT = 'select',
  LLM_MODEL_SELECTOR = 'llm-model-selector',
  PROMPT_EDITOR = 'prompt-editor',
  UNKNOWN = 'unknown',
  KNOWLEDGE_BASE_SELECTOR = 'knowledge-base-selector',
}

export interface IFileConfig {
  file_key: string;
  mimetype: string;
}

export interface IDynamicFormItemOption {
  name: string;
  label: I18nObject;
}
