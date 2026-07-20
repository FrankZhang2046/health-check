export type CheckStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface Check {
  name: string;
  status: CheckStatus;
  latencyMs: number;
  critical: boolean;
  error?: string;
}

export interface HealthResponse {
  status: CheckStatus;
  service: string;
  version: string;
  timestamp: string;
  checks: Check[];
}
