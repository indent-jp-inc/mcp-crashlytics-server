import { z } from 'zod';

export const ImpactLevel = z.enum(['high', 'medium', 'low']);
export type ImpactLevel = z.infer<typeof ImpactLevel>;

export const ImpactFilter = z.enum(['high', 'medium', 'low', 'all']);
export type ImpactFilter = z.infer<typeof ImpactFilter>;

export const Platform = z.enum(['ios', 'android', 'all']);
export type Platform = z.infer<typeof Platform>;

export const TimeRange = z.enum(['24h', '7d', '30d', 'all']);
export type TimeRange = z.infer<typeof TimeRange>;

export const GroupBy = z.enum(['version', 'device', 'os', 'issue_type']);
export type GroupBy = z.infer<typeof GroupBy>;

export interface ServerConfig {
  serviceAccountKey: string;
  projectId: string;
  datasetId: string;
  defaultCrashLimit: number;
}

export interface CrashSummary {
  id: string;
  timestamp: string;
  impact: ImpactLevel;
  affected_users: number;
  occurrences: number;
  app_version: string;
  platform: string;
  crash_message: string;
  is_fatal: boolean;
  title: string;
}

export interface StackFrame {
  method: string;
  class: string;
  file: string;
  line: number;
  column?: number;
  library?: string;
}

export interface StackTrace {
  exception_type: string;
  message: string;
  frames: StackFrame[];
}

export interface DeviceInfo {
  model: string;
  os_version: string;
  memory_available: string;
  storage_available: string;
  orientation: string;
  battery_level?: number;
}

export interface CrashContext {
  app_version: string;
  os_version: string;
  device: string;
  memory_available: string;
  breadcrumbs: string[];
  custom_keys: Record<string, any>;
  session_id: string;
  user_id?: string;
}

export interface CrashDetails {
  crash_summary: CrashSummary;
  stack_trace: StackTrace;
  context: CrashContext;
  device_info: DeviceInfo;
  suggested_fix_context: string;
}

export interface CrashTrend {
  date: string;
  crash_count: number;
  affected_users: number;
  crash_free_rate: number;
}

export interface TrendAnalysis {
  time_range: TimeRange;
  trends: CrashTrend[];
  top_crashes: CrashSummary[];
  most_affected_devices: Array<{
    device: string;
    crash_count: number;
    percentage: number;
  }>;
  crash_free_percentage: number;
}

export const FetchCrashesParams = z.object({
  limit: z.number().positive().optional(),
  impact_filter: ImpactFilter.optional(),
  time_range: TimeRange.optional(),
  app_version: z.string().optional(),
  platform: Platform.optional(),
});

export const GetCrashDetailsParams = z.object({
  crash_id: z.string().min(1),
});

export const AnalyzeCrashTrendsParams = z.object({
  time_range: TimeRange,
  group_by: GroupBy.optional(),
});

export type FetchCrashesParams = z.infer<typeof FetchCrashesParams>;
export type GetCrashDetailsParams = z.infer<typeof GetCrashDetailsParams>;
export type AnalyzeCrashTrendsParams = z.infer<typeof AnalyzeCrashTrendsParams>;

export interface BigQueryCrashRow {
  crash_id: string;
  timestamp: string;
  event_name: string;
  platform: string;
  app_version: string;
  bundle_id: string;
  exception_type: string;
  exception_message: string;
  stack_trace: string;
  is_fatal: boolean;
  device_model: string;
  os_version: string;
  memory_available: bigint;
  storage_available: bigint;
  user_id: string;
  session_id: string;
  custom_keys: string;
  breadcrumbs: string;
}