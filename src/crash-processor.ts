import { 
  BigQueryCrashRow, 
  CrashSummary, 
  CrashDetails, 
  StackTrace, 
  StackFrame, 
  DeviceInfo, 
  CrashContext,
  TrendAnalysis,
  CrashTrend
} from './types.js';
import { ImpactAnalyzer } from './impact-analyzer.js';

export class CrashProcessor {
  private impactAnalyzer: ImpactAnalyzer;

  constructor(totalUsers: number = 10000) {
    this.impactAnalyzer = new ImpactAnalyzer(totalUsers);
  }

  processCrashRows(rows: BigQueryCrashRow[]): CrashSummary[] {
    const crashMap = new Map<string, { row: BigQueryCrashRow; count: number; users: Set<string> }>();

    rows.forEach(row => {
      const key = `${row.exception_type}-${row.exception_message}-${row.app_version}`;
      
      if (crashMap.has(key)) {
        const existing = crashMap.get(key)!;
        existing.count++;
        if (row.user_id) {
          existing.users.add(row.user_id);
        }
      } else {
        const users = new Set<string>();
        if (row.user_id) {
          users.add(row.user_id);
        }
        crashMap.set(key, { row, count: 1, users });
      }
    });

    const summaries: CrashSummary[] = Array.from(crashMap.values()).map(({ row, count, users }) => {
      const affectedUsers = users.size;
      const impact = this.impactAnalyzer.calculateImpactLevel(affectedUsers, count, row.is_fatal);
      
      return {
        id: row.crash_id,
        timestamp: row.timestamp,
        impact,
        affected_users: affectedUsers,
        occurrences: count,
        app_version: row.app_version,
        platform: row.platform,
        crash_message: row.exception_message || 'Unknown error',
        is_fatal: row.is_fatal,
        title: this.generateCrashTitle(row.exception_type, row.exception_message)
      };
    });

    return this.impactAnalyzer.sortByImpactAndFrequency(summaries);
  }

  processCrashDetails(row: BigQueryCrashRow): CrashDetails {
    const stackTrace = this.parseStackTrace(row.stack_trace);
    const deviceInfo = this.extractDeviceInfo(row);
    const context = this.extractCrashContext(row);
    
    const affectedUsers = 1;
    const impact = this.impactAnalyzer.calculateImpactLevel(affectedUsers, 1, row.is_fatal);

    const crashSummary: CrashSummary = {
      id: row.crash_id,
      timestamp: row.timestamp,
      impact,
      affected_users: 1,
      occurrences: 1,
      app_version: row.app_version,
      platform: row.platform,
      crash_message: row.exception_message || 'Unknown error',
      is_fatal: row.is_fatal,
      title: this.generateCrashTitle(row.exception_type, row.exception_message)
    };

    const suggestedFixContext = this.impactAnalyzer.generateFixSuggestionContext(
      row.exception_type,
      stackTrace.frames,
      row.exception_message,
      row.app_version
    );

    return {
      crash_summary: crashSummary,
      stack_trace: stackTrace,
      context,
      device_info: deviceInfo,
      suggested_fix_context: suggestedFixContext
    };
  }

  private parseStackTrace(stackTraceString: string): StackTrace {
    if (!stackTraceString) {
      return {
        exception_type: 'Unknown',
        message: 'No stack trace available',
        frames: []
      };
    }

    const lines = stackTraceString.split('\n').map(line => line.trim()).filter(line => line);
    
    let exceptionType = 'Unknown';
    let message = 'Unknown error';
    const frames: StackFrame[] = [];

    if (lines.length > 0) {
      const firstLine = lines[0];
      const exceptionMatch = firstLine.match(/^(\w+(?:\.\w+)*(?:Exception|Error)?)(?::\s*(.*))?$/);
      
      if (exceptionMatch) {
        exceptionType = exceptionMatch[1];
        message = exceptionMatch[2] || 'No message';
      }
    }

    lines.slice(1).forEach(line => {
      const frame = this.parseStackFrame(line);
      if (frame) {
        frames.push(frame);
      }
    });

    return {
      exception_type: exceptionType,
      message,
      frames
    };
  }

  private parseStackFrame(line: string): StackFrame | null {
    const patterns = [
      /at\s+(.+)\.(\w+)\(([^:]+):(\d+)(?::(\d+))?\)/,
      /at\s+(.+)\.(\w+)\((.+)\)/,
      /\s*#\d+\s+pc\s+[0-9a-f]+\s+(.+)\s+\((.+)\+(\d+)\)/,
      /(.+)\s+\((.+):(\d+)\)/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return this.createStackFrame(match);
      }
    }

    return null;
  }

  private createStackFrame(match: RegExpMatchArray): StackFrame {
    if (match.length >= 4) {
      const className = match[1]?.split('.').pop() || 'Unknown';
      const method = match[2] || 'unknown';
      const file = match[3] || 'Unknown';
      const line = parseInt(match[4]) || 0;
      const column = match[5] ? parseInt(match[5]) : undefined;

      return {
        method,
        class: match[1] || className,
        file,
        line,
        column,
        library: this.detectLibrary(match[1] || '')
      };
    }

    return {
      method: 'unknown',
      class: 'Unknown',
      file: 'Unknown',
      line: 0
    };
  }

  private detectLibrary(className: string): string | undefined {
    const libraryPrefixes = [
      'android.',
      'androidx.',
      'com.google.',
      'java.',
      'kotlin.',
      'swift.',
      'foundation.',
      'uikit.'
    ];

    for (const prefix of libraryPrefixes) {
      if (className.toLowerCase().startsWith(prefix.toLowerCase())) {
        return prefix.slice(0, -1);
      }
    }

    return undefined;
  }

  private extractDeviceInfo(row: BigQueryCrashRow): DeviceInfo {
    return {
      model: row.device_model || 'Unknown',
      os_version: row.os_version || 'Unknown',
      memory_available: this.formatMemory(row.memory_available),
      storage_available: this.formatMemory(row.storage_available),
      orientation: 'Unknown',
      battery_level: undefined
    };
  }

  private extractCrashContext(row: BigQueryCrashRow): CrashContext {
    let breadcrumbs: string[] = [];
    let customKeys: Record<string, any> = {};

    try {
      if (row.breadcrumbs) {
        breadcrumbs = JSON.parse(row.breadcrumbs);
      }
    } catch (e) {
      breadcrumbs = row.breadcrumbs ? [row.breadcrumbs] : [];
    }

    try {
      if (row.custom_keys) {
        customKeys = JSON.parse(row.custom_keys);
      }
    } catch (e) {
      customKeys = {};
    }

    return {
      app_version: row.app_version || 'Unknown',
      os_version: row.os_version || 'Unknown',
      device: row.device_model || 'Unknown',
      memory_available: this.formatMemory(row.memory_available),
      breadcrumbs,
      custom_keys: customKeys,
      session_id: row.session_id || 'Unknown',
      user_id: row.user_id
    };
  }

  private formatMemory(bytes: bigint | number | undefined): string {
    if (!bytes) return 'Unknown';
    
    const numBytes = typeof bytes === 'bigint' ? Number(bytes) : bytes;
    const gb = numBytes / (1024 * 1024 * 1024);
    
    if (gb >= 1) {
      return `${gb.toFixed(1)}GB`;
    }
    
    const mb = numBytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  }

  private generateCrashTitle(exceptionType: string, message: string): string {
    const shortType = exceptionType.split('.').pop() || exceptionType;
    const shortMessage = message ? (message.length > 50 ? message.substring(0, 47) + '...' : message) : '';
    
    return shortMessage ? `${shortType}: ${shortMessage}` : shortType;
  }

  processTrendAnalysis(
    crashStats: any[], 
    crashFreeCounts: any[], 
    topCrashes: CrashSummary[],
    timeRange: string
  ): TrendAnalysis {
    const trends: CrashTrend[] = crashFreeCounts.map(row => ({
      date: row.date,
      crash_count: row.crashed_users || 0,
      affected_users: row.crashed_users || 0,
      crash_free_rate: row.crash_free_rate || 100
    }));

    const overallCrashFreeRate = crashFreeCounts.length > 0
      ? crashFreeCounts.reduce((sum, row) => sum + (row.crash_free_rate || 100), 0) / crashFreeCounts.length
      : 100;

    const deviceStats = this.aggregateDeviceStats(crashStats);

    return {
      time_range: timeRange as any,
      trends,
      top_crashes: topCrashes.slice(0, 10),
      most_affected_devices: deviceStats,
      crash_free_percentage: Math.round(overallCrashFreeRate * 100) / 100
    };
  }

  private aggregateDeviceStats(crashStats: any[]): Array<{ device: string; crash_count: number; percentage: number }> {
    const deviceMap = new Map<string, number>();
    let totalCrashes = 0;

    crashStats.forEach(stat => {
      const device = stat.group_key || 'Unknown';
      const count = stat.crash_count || 0;
      deviceMap.set(device, (deviceMap.get(device) || 0) + count);
      totalCrashes += count;
    });

    return Array.from(deviceMap.entries())
      .map(([device, crash_count]) => ({
        device,
        crash_count,
        percentage: totalCrashes > 0 ? Math.round((crash_count / totalCrashes) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.crash_count - a.crash_count)
      .slice(0, 10);
  }
}