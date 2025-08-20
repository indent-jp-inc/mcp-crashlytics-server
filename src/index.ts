#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { BigQueryClient } from './bigquery-client.js';
import { CrashProcessor } from './crash-processor.js';
import { ImpactAnalyzer } from './impact-analyzer.js';
import {
  ServerConfig,
  FetchCrashesParams,
  GetCrashDetailsParams,
  AnalyzeCrashTrendsParams,
} from './types.js';

class CrashlyticsServer {
  private server: Server;
  private bigQueryClient: BigQueryClient | null = null;
  private crashProcessor: CrashProcessor | null = null;
  private config: ServerConfig | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-crashlytics-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async initialize(): Promise<void> {
    if (this.bigQueryClient) return;

    try {
      this.config = {
        serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
        projectId: process.env.BIGQUERY_PROJECT_ID || '',
        datasetId: process.env.BIGQUERY_DATASET_ID || '',
        defaultCrashLimit: parseInt(process.env.DEFAULT_CRASH_LIMIT || '10', 10),
      };

      if (!this.config.serviceAccountKey || !this.config.projectId || !this.config.datasetId) {
        throw new Error(
          'Missing required environment variables: GOOGLE_SERVICE_ACCOUNT_KEY, BIGQUERY_PROJECT_ID, BIGQUERY_DATASET_ID'
        );
      }

      this.bigQueryClient = new BigQueryClient(this.config);
      this.crashProcessor = new CrashProcessor();

      const isConnected = await this.bigQueryClient.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to BigQuery');
      }

      console.error('Crashlytics MCP server initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Crashlytics MCP server:', error);
      throw error;
    }
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_available_apps',
            description: 'List all available apps in the Firebase Crashlytics dataset',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_fatal_crashes',
            description: 'Get fatal crashes for a specific app package name',
            inputSchema: {
              type: 'object',
              properties: {
                app_package: {
                  type: 'string',
                  description: 'App package name (e.g., com.example.myapp)',
                  minLength: 1,
                },
                limit: {
                  type: 'number',
                  description: 'Number of fatal crashes to fetch (default: 10, max: 50)',
                  minimum: 1,
                  maximum: 50,
                  default: 10
                },
              },
              required: ['app_package'],
            },
          },
          {
            name: 'get_anr_issues',
            description: 'Get ANR (Application Not Responding) issues for a specific app package name',
            inputSchema: {
              type: 'object',
              properties: {
                app_package: {
                  type: 'string',
                  description: 'App package name (e.g., com.example.myapp)',
                  minLength: 1,
                },
                limit: {
                  type: 'number',
                  description: 'Number of ANR issues to fetch (default: 10, max: 50)',
                  minimum: 1,
                  maximum: 50,
                  default: 10
                },
              },
              required: ['app_package'],
            },
          },
          {
            name: 'get_crash_details',
            description: 'Get detailed information for a specific crash',
            inputSchema: {
              type: 'object',
              properties: {
                crash_id: {
                  type: 'string',
                  description: 'Unique crash identifier',
                  minLength: 1,
                },
              },
              required: ['crash_id'],
            },
          },
          {
            name: 'analyze_crash_trends',
            description: 'Analyze crash trends and statistics over time',
            inputSchema: {
              type: 'object',
              properties: {
                time_range: {
                  type: 'string',
                  enum: ['24h', '7d', '30d', 'all'],
                  description: 'Analysis period',
                },
                group_by: {
                  type: 'string',
                  enum: ['version', 'device', 'os', 'issue_type'],
                  description: 'Grouping criteria',
                },
              },
              required: ['time_range'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.initialize();

      if (!this.bigQueryClient || !this.crashProcessor) {
        throw new McpError(ErrorCode.InternalError, 'Server not properly initialized');
      }

      try {
        switch (request.params.name) {
          case 'list_available_apps':
            return await this.handleListAvailableApps();

          case 'get_fatal_crashes':
            return await this.handleGetFatalCrashes(request.params.arguments);

          case 'get_anr_issues':
            return await this.handleGetAnrIssues(request.params.arguments);

          case 'get_crash_details':
            return await this.handleGetCrashDetails(request.params.arguments);

          case 'analyze_crash_trends':
            return await this.handleAnalyzeCrashTrends(request.params.arguments);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        console.error(`Error in ${request.params.name}:`, error);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  private async handleListAvailableApps() {
    const apps = await this.bigQueryClient!.discoverApps();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            available_apps: apps.map(app => ({
              app_package: app.app_package,
              platform: app.platform,
              total_crashes: app.total_crashes,
              fatal_crashes: app.fatal_crashes,
              non_fatal_crashes: app.non_fatal_crashes
            })),
            message: "Available apps in your Firebase Crashlytics dataset. Use get_fatal_crashes or get_anr_issues with the app_package."
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetFatalCrashes(args: any) {
    const appPackage = args?.app_package;
    const limit = args?.limit || 10;
    
    if (!appPackage) {
      throw new McpError(ErrorCode.InvalidRequest, 'app_package parameter is required');
    }
    
    const rows = await this.bigQueryClient!.fetchFatalCrashesByApp(appPackage, limit);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            app_package: appPackage,
            fatal_crashes: rows.map((crash: any) => ({
              crash_id: crash.event_id,
              timestamp: crash.event_timestamp,
              issue_title: crash.issue_title,
              issue_subtitle: crash.issue_subtitle,
              device: crash.device,
              app_version: crash.application?.display_version,
              exception_info: crash.exceptions?.[0] || null
            })),
            total_found: rows.length,
            message: `Found ${rows.length} fatal crashes for ${appPackage}`
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetAnrIssues(args: any) {
    const appPackage = args?.app_package;
    const limit = args?.limit || 10;
    
    if (!appPackage) {
      throw new McpError(ErrorCode.InvalidRequest, 'app_package parameter is required');
    }
    
    const rows = await this.bigQueryClient!.fetchANRIssuesByApp(appPackage, limit);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            app_package: appPackage,
            anr_issues: rows.map((crash: any) => ({
              crash_id: crash.event_id,
              timestamp: crash.event_timestamp,
              issue_title: crash.issue_title,
              issue_subtitle: crash.issue_subtitle,
              device: crash.device,
              app_version: crash.application?.display_version,
              process_state: crash.process_state,
              blame_frame: crash.blame_frame
            })),
            total_found: rows.length,
            message: `Found ${rows.length} ANR issues for ${appPackage}`
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetCrashDetails(args: any) {
    const params = GetCrashDetailsParams.parse(args);
    
    const row = await this.bigQueryClient!.getCrashDetails(params);
    if (!row) {
      throw new McpError(ErrorCode.InvalidRequest, `Crash not found: ${params.crash_id}`);
    }

    const crashDetails = this.crashProcessor!.processCrashDetails(row);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(crashDetails, null, 2),
        },
      ],
    };
  }

  private async handleAnalyzeCrashTrends(args: any) {
    const params = AnalyzeCrashTrendsParams.parse(args);
    
    const [crashStats, crashFreeCounts] = await Promise.all([
      this.bigQueryClient!.getCrashStatistics(params),
      this.bigQueryClient!.getCrashFreeCounts(params.time_range),
    ]);

    const topCrashRows = await this.bigQueryClient!.fetchCrashes({
      limit: 10,
      time_range: params.time_range,
    });
    const topCrashes = this.crashProcessor!.processCrashRows(topCrashRows);

    const trendAnalysis = this.crashProcessor!.processTrendAnalysis(
      crashStats,
      crashFreeCounts,
      topCrashes,
      params.time_range
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_period: params.time_range,
            group_by: params.group_by || 'version',
            ...trendAnalysis,
          }, null, 2),
        },
      ],
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Crashlytics MCP server running on stdio');
  }
}

const server = new CrashlyticsServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});