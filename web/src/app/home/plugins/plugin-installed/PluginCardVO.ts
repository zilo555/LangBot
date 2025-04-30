export interface IPluginCardVO {
  author: string;
  version: string;
  name: string;
  description: string;
  handlerCount: number;
  isInitialized: boolean;
}

export class PluginCardVO implements IPluginCardVO {
  description: string;
  handlerCount: number;
  name: string;
  author: string;
  version: string;
  isInitialized: boolean;

  constructor(prop: IPluginCardVO) {
    this.description = prop.description;
    this.handlerCount = prop.handlerCount;
    this.name = prop.name;
    this.author = prop.author;
    this.version = prop.version;
    this.isInitialized = prop.isInitialized;
  }
}
