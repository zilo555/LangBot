export interface IPluginCardVO {
  author: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  priority: number;
  install_source: string;
  install_info: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  status: string;
  tools: object[];
  event_handlers: object;
  debug: boolean;
}

export class PluginCardVO implements IPluginCardVO {
  author: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  priority: number;
  debug: boolean;
  install_source: string;
  install_info: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  status: string;
  tools: object[];
  event_handlers: object;

  constructor(prop: IPluginCardVO) {
    this.author = prop.author;
    this.description = prop.description;
    this.enabled = prop.enabled;
    this.event_handlers = prop.event_handlers;
    this.name = prop.name;
    this.priority = prop.priority;
    this.status = prop.status;
    this.tools = prop.tools;
    this.version = prop.version;
    this.debug = prop.debug;
    this.install_source = prop.install_source;
    this.install_info = prop.install_info;
  }
}
