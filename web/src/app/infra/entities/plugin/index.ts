import { ComponentManifest } from '@/app/infra/entities/common';

export interface Plugin {
  status: 'intialized' | 'mounted' | 'unmounted';
  priority: number;
  plugin_config: object;
  manifest: {
    manifest: ComponentManifest;
  };
  debug: boolean;
  enabled: boolean;
  components: {
    component_config: object;
    manifest: {
      manifest: ComponentManifest;
    };
  };
}
