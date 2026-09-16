export type PipelineMigrationState =
  | 'ready'
  | 'needs_plugin'
  | 'blocked'
  | 'already_current'
  | 'not_legacy'
  | 'activation_pending';

export interface PipelineMigrationIssue {
  code: string;
  field?: string | null;
}

export interface PipelineMigrationItem {
  pipeline_uuid: string;
  name: string;
  state: PipelineMigrationState;
  legacy_runner: string | null;
  target_runner_id: string | null;
  target_plugin: { author: string; name: string; version: string } | null;
  changed_paths: string[];
  blockers: PipelineMigrationIssue[];
  warnings: PipelineMigrationIssue[];
  preview_token: string | null;
}

export interface PipelineMigrationPreview {
  planner_version: string;
  workspace_uuid: string;
  items: PipelineMigrationItem[];
  total: number;
}

export interface PipelineMigrationRequest {
  confirmed: true;
  items: { pipeline_uuid: string; preview_token: string }[];
}

export interface PipelineMigrationResult {
  pipeline_uuid: string;
  state:
    | 'pending'
    | 'migrated'
    | 'already_current'
    | 'blocked'
    | 'stale'
    | 'failed'
    | 'activation_pending';
  code: string | null;
}

export interface PipelineMigrationTaskMetadata {
  kind: 'pipeline_migration';
  results: PipelineMigrationResult[];
}
