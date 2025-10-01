import { BigQuery } from '@google-cloud/bigquery';
import { 
  ServerConfig, 
  BigQueryCrashRow, 
  FetchCrashesParams, 
  GetCrashDetailsParams,
  GetCrashDetailsByIssueIdParams,
  AnalyzeCrashTrendsParams,
  TimeRange,
  Platform 
} from './types.js';

export class BigQueryClient {
  private bigquery: BigQuery;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    
    let credentials;
    try {
      if (config.serviceAccountKey.startsWith('{')) {
        // Direct JSON string
        credentials = JSON.parse(config.serviceAccountKey);
      } else if (config.serviceAccountKey.startsWith('eyJ')) {
        // Base64-encoded JSON
        const decodedJson = Buffer.from(config.serviceAccountKey, 'base64').toString('utf-8');
        credentials = JSON.parse(decodedJson);
      } else {
        // File path
        credentials = require(config.serviceAccountKey);
      }
    } catch (error) {
      throw new Error(`Failed to parse service account credentials: ${error}`);
    }

    this.bigquery = new BigQuery({
      projectId: config.projectId,
      credentials,
    });
  }

  private getTimeRangeCondition(timeRange: TimeRange): string {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        return '';
    }

    return `AND event_timestamp >= TIMESTAMP('${startDate.toISOString()}')`;
  }

  private getPlatformCondition(platform: Platform): string {
    if (platform === 'all') return '';
    return `AND platform = '${platform}'`;
  }

  async fetchCrashes(params: FetchCrashesParams): Promise<BigQueryCrashRow[]> {
    const limit = params.limit || this.config.defaultCrashLimit;
    const timeCondition = params.time_range ? this.getTimeRangeCondition(params.time_range) : '';
    const versionCondition = params.app_version ? `AND app_version = '${params.app_version}'` : '';

    // First, let's try a simple query to understand the schema
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      WHERE 1=1
        ${timeCondition}
        ${versionCondition}
      ORDER BY event_timestamp DESC
      LIMIT ${limit}
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      return rows as BigQueryCrashRow[];
    } catch (error) {
      throw new Error(`BigQuery query failed: ${error}`);
    }
  }

  async getCrashDetails(params: GetCrashDetailsParams): Promise<BigQueryCrashRow | null> {
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      WHERE event_id = '${params.crash_id}'
      LIMIT 1
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      if (rows.length === 0) return null;

      const row = rows[0];
      return {
        crash_id: row.event_id || params.crash_id,
        timestamp: row.event_timestamp || new Date().toISOString(),
        event_name: row.event_name || 'crash',
        platform: row.platform || 'Unknown',
        app_version: row.application?.display_version || row.app_version || 'Unknown',
        bundle_id: row.bundle_identifier || 'Unknown',
        exception_type: row.exception_info?.type || row.error_type || row.issue_title || 'Unknown',
        exception_message: row.exception_info?.exception_message || row.issue_subtitle || 'Unknown',
        stack_trace: JSON.stringify(row.exception_info?.frames || row.exception_info || []),
        is_fatal: row.is_fatal !== undefined ? row.is_fatal : true,
        device_model: row.device?.model || 'Unknown',
        os_version: row.device?.os_version || 'Unknown',
        memory_available: BigInt(row.device?.ram_mb ? row.device.ram_mb * 1024 * 1024 : 0),
        storage_available: BigInt(row.device?.disk_mb ? row.device.disk_mb * 1024 * 1024 : 0),
        user_id: row.user_id || '',
        session_id: row.session_id || '',
        custom_keys: JSON.stringify(row.custom_keys || {}),
        breadcrumbs: JSON.stringify(row.breadcrumbs || [])
      } as BigQueryCrashRow;
    } catch (error) {
      throw new Error(`BigQuery query failed: ${error}`);
    }
  }

  async getCrashDetailsByIssueId(params: GetCrashDetailsByIssueIdParams): Promise<BigQueryCrashRow[]> {
    const limit = params.limit || 10;
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      WHERE issue_id = '${params.issue_id}'
      ORDER BY event_timestamp DESC
      LIMIT ${limit}
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      if (rows.length === 0) return [];

      return rows.map(row => ({
        crash_id: row.event_id || row.issue_id,
        timestamp: row.event_timestamp || new Date().toISOString(),
        event_name: row.event_name || 'crash',
        platform: row.platform || 'Unknown',
        app_version: row.application?.display_version || row.app_version || 'Unknown',
        bundle_id: row.bundle_identifier || 'Unknown',
        exception_type: row.exception_info?.type || row.error_type || row.issue_title || 'Unknown',
        exception_message: row.exception_info?.exception_message || row.issue_subtitle || 'Unknown',
        stack_trace: JSON.stringify(row.exception_info?.frames || row.exception_info || []),
        is_fatal: row.is_fatal !== undefined ? row.is_fatal : true,
        device_model: row.device?.model || 'Unknown',
        os_version: row.device?.os_version || 'Unknown',
        memory_available: BigInt(row.device?.ram_mb ? row.device.ram_mb * 1024 * 1024 : 0),
        storage_available: BigInt(row.device?.disk_mb ? row.device.disk_mb * 1024 * 1024 : 0),
        user_id: row.user_id || '',
        session_id: row.session_id || '',
        custom_keys: JSON.stringify(row.custom_keys || {}),
        breadcrumbs: JSON.stringify(row.breadcrumbs || [])
      } as BigQueryCrashRow));
    } catch (error) {
      throw new Error(`BigQuery query failed: ${error}`);
    }
  }


  async getCrashStatistics(params: AnalyzeCrashTrendsParams): Promise<any[]> {
    const timeCondition = this.getTimeRangeCondition(params.time_range);
    const groupByColumn = this.getGroupByColumn(params.group_by || 'version');

    const query = `
      SELECT 
        ${groupByColumn} as group_key,
        COUNT(*) as crash_count,
        COUNT(DISTINCT user_id) as affected_users,
        DATE(event_timestamp) as crash_date
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      WHERE 1=1
        ${timeCondition}
      GROUP BY group_key, crash_date
      ORDER BY crash_date DESC, crash_count DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      return rows;
    } catch (error) {
      throw new Error(`BigQuery statistics query failed: ${error}`);
    }
  }

  async getCrashFreeCounts(timeRange: TimeRange): Promise<any[]> {
    const timeCondition = this.getTimeRangeCondition(timeRange);

    const query = `
      WITH daily_stats AS (
        SELECT 
          DATE(event_timestamp) as date,
          COUNT(DISTINCT user_id) as crashed_users,
          COUNT(DISTINCT user_id) as total_users
        FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
        WHERE 1=1 ${timeCondition}
        GROUP BY date
      )
      SELECT 
        date,
        crashed_users,
        total_users,
        SAFE_DIVIDE((total_users - crashed_users), total_users) * 100 as crash_free_rate
      FROM daily_stats
      ORDER BY date DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      return rows;
    } catch (error) {
      throw new Error(`BigQuery crash-free query failed: ${error}`);
    }
  }

  private getGroupByColumn(groupBy: string): string {
    switch (groupBy) {
      case 'version':
        return 'app_version';
      case 'device':
        return 'device_info.device_model';
      case 'os':
        return 'device_info.os_version';
      case 'issue_type':
        return 'crash_info.exception_type';
      default:
        return 'app_version';
    }
  }

  async discoverApps(): Promise<any[]> {
    const query = `
      SELECT 
        bundle_identifier,
        platform,
        COUNT(*) as total_crashes,
        MAX(event_timestamp) as latest_crash,
        MIN(event_timestamp) as earliest_crash,
        COUNTIF(is_fatal = true) as fatal_crashes,
        COUNTIF(is_fatal = false) as non_fatal_crashes
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      GROUP BY bundle_identifier, platform
      ORDER BY total_crashes DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      return rows.map((row: any) => ({
        app_package: row.bundle_identifier,
        platform: row.platform,
        total_crashes: row.total_crashes,
        fatal_crashes: row.fatal_crashes,
        non_fatal_crashes: row.non_fatal_crashes,
        latest_crash: row.latest_crash,
        earliest_crash: row.earliest_crash
      }));
    } catch (error) {
      throw new Error(`Failed to discover apps: ${error}`);
    }
  }

  async fetchCrashesByApp(appPackageName: string, params: FetchCrashesParams): Promise<BigQueryCrashRow[]> {
    const limit = params.limit || this.config.defaultCrashLimit;
    const timeCondition = params.time_range ? this.getTimeRangeCondition(params.time_range) : '';
    const versionCondition = params.app_version ? `AND application.display_version = '${params.app_version}'` : '';
    const platformCondition = params.platform ? `AND UPPER(platform) = UPPER('${params.platform}')` : '';

    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      WHERE bundle_identifier = '${appPackageName}'
        ${timeCondition}
        ${versionCondition}
        ${platformCondition}
      ORDER BY event_timestamp DESC
      LIMIT ${limit}
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      return rows as BigQueryCrashRow[];
    } catch (error) {
      throw new Error(`BigQuery app-specific query failed: ${error}`);
    }
  }

  async fetchFatalCrashesByApp(appPackageName: string, limit: number = 10): Promise<BigQueryCrashRow[]> {
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      WHERE bundle_identifier = '${appPackageName}'
        AND is_fatal = true
      ORDER BY event_timestamp DESC
      LIMIT ${limit}
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      return rows as BigQueryCrashRow[];
    } catch (error) {
      throw new Error(`Failed to fetch fatal crashes: ${error}`);
    }
  }

  async fetchANRIssuesByApp(appPackageName: string, limit: number = 10): Promise<BigQueryCrashRow[]> {
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.*\`
      WHERE bundle_identifier = '${appPackageName}'
        AND UPPER(error_type) = 'ANR'
      ORDER BY event_timestamp DESC
      LIMIT ${limit}
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        location: 'US',
      });

      return rows as BigQueryCrashRow[];
    } catch (error) {
      throw new Error(`Failed to fetch ANR issues: ${error}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const query = `SELECT 1 as test_value LIMIT 1`;
      await this.bigquery.query({ query, location: 'US' });
      return true;
    } catch (error) {
      console.error('BigQuery connection test failed:', error);
      return false;
    }
  }
}
