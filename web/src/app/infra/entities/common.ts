export interface I18nLabel {
  en_US: string;
  zh_Hans: string;
  ja_JP?: string;
}

export interface ComponentManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    label: I18nLabel;
    description?: I18nLabel;
    icon?: string;
    repository?: string;
    version?: string;
    author?: string;
  };
  spec: object;
}
