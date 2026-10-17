import type { HealthCheckResponse, ReadinessCheckResponse, ApiResponse } from '@newtonite/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  const body = (await res.json()) as ApiResponse<HealthCheckResponse>;
  if (!body.success) {
    throw new Error(body.error.message);
  }
  return body.data;
}

export async function fetchReadiness(): Promise<ReadinessCheckResponse> {
  const res = await fetch(`${API_BASE_URL}/ready`);
  const body = (await res.json()) as ApiResponse<ReadinessCheckResponse>;
  if (!body.success) {
    throw new Error(body.error.message);
  }
  return body.data;
}
