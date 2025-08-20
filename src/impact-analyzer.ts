import { ImpactLevel, CrashSummary } from './types.js';

export class ImpactAnalyzer {
  private totalUsers: number;

  constructor(totalUsers: number = 10000) {
    this.totalUsers = totalUsers;
  }

  calculateImpactLevel(affectedUsers: number, occurrences: number, isFatal: boolean): ImpactLevel {
    const userPercentage = (affectedUsers / this.totalUsers) * 100;

    if (isFatal) {
      if (affectedUsers > 100 || userPercentage > 5) {
        return 'high';
      } else if (affectedUsers >= 10 || userPercentage >= 1) {
        return 'medium';
      } else {
        return 'low';
      }
    } else {
      if (affectedUsers > 500 || userPercentage > 10 || occurrences > 1000) {
        return 'high';
      } else if (affectedUsers >= 50 || userPercentage >= 2 || occurrences >= 100) {
        return 'medium';
      } else {
        return 'low';
      }
    }
  }

  filterByImpact(crashes: CrashSummary[], impactFilter: ImpactLevel): CrashSummary[] {
    return crashes.filter(crash => crash.impact === impactFilter);
  }

  sortByImpactAndFrequency(crashes: CrashSummary[]): CrashSummary[] {
    const impactWeight = { high: 3, medium: 2, low: 1 };
    
    return crashes.sort((a, b) => {
      const impactDiff = impactWeight[b.impact] - impactWeight[a.impact];
      if (impactDiff !== 0) return impactDiff;
      
      return b.occurrences - a.occurrences;
    });
  }

  generateFixSuggestionContext(
    exceptionType: string, 
    stackFrames: any[], 
    crashMessage: string,
    appVersion: string
  ): string {
    const topFrame = stackFrames[0];
    const context = [];

    context.push(`The crash occurs in ${topFrame?.class || 'unknown class'}`);
    if (topFrame?.method) {
      context.push(`in the ${topFrame.method} method`);
    }
    if (topFrame?.file && topFrame?.line) {
      context.push(`at ${topFrame.file}:${topFrame.line}`);
    }

    context.push(`when a ${exceptionType} is thrown`);
    
    if (crashMessage) {
      context.push(`with the message: "${crashMessage}"`);
    }

    if (this.isCommonException(exceptionType)) {
      context.push(this.getCommonExceptionAdvice(exceptionType));
    }

    if (appVersion) {
      context.push(`This occurs in app version ${appVersion}`);
    }

    return context.join('. ') + '.';
  }

  private isCommonException(exceptionType: string): boolean {
    const commonExceptions = [
      'NullPointerException',
      'IndexOutOfBoundsException',
      'IllegalArgumentException',
      'ClassCastException',
      'ConcurrentModificationException',
      'OutOfMemoryError',
      'StackOverflowError'
    ];
    
    return commonExceptions.some(type => exceptionType.includes(type));
  }

  private getCommonExceptionAdvice(exceptionType: string): string {
    const advice: Record<string, string> = {
      'NullPointerException': 'Check for null values before accessing object methods or properties',
      'IndexOutOfBoundsException': 'Verify array/list bounds before accessing elements',
      'IllegalArgumentException': 'Validate method parameters before use',
      'ClassCastException': 'Verify object types before casting',
      'ConcurrentModificationException': 'Use thread-safe collections or synchronization when modifying collections across threads',
      'OutOfMemoryError': 'Review memory usage, optimize data structures, or increase heap size',
      'StackOverflowError': 'Check for infinite recursion or deeply nested method calls'
    };

    for (const [key, value] of Object.entries(advice)) {
      if (exceptionType.includes(key)) {
        return value;
      }
    }

    return 'Review the stack trace to identify the root cause';
  }

  calculateCrashFreeRate(totalUsers: number, crashedUsers: number): number {
    if (totalUsers === 0) return 100;
    return ((totalUsers - crashedUsers) / totalUsers) * 100;
  }

  identifyTrends(crashCounts: Array<{ date: string; count: number }>): {
    trend: 'increasing' | 'decreasing' | 'stable';
    changeRate: number;
  } {
    if (crashCounts.length < 2) {
      return { trend: 'stable', changeRate: 0 };
    }

    const recent = crashCounts.slice(-3);
    const older = crashCounts.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, item) => sum + item.count, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, item) => sum + item.count, 0) / older.length 
      : recentAvg;

    const changeRate = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    if (Math.abs(changeRate) < 10) {
      return { trend: 'stable', changeRate };
    } else if (changeRate > 0) {
      return { trend: 'increasing', changeRate };
    } else {
      return { trend: 'decreasing', changeRate };
    }
  }
}