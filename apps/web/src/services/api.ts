import type {
  HealthCheckResponse,
  ReadinessCheckResponse,
  ApiResponse,
  WorkItemSummaryDTO,
  ActivityEventDTO,
  CommentDTO,
  WorkItemStatus,
  Priority,
  WorkItemType,
} from '@newtonite/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  memberships: Array<{
    teamId: string;
    teamName: string;
    role: 'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN';
  }>;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !body.success) {
    const errorMsg = !body.success && body.error ? body.error.message : `HTTP ${res.status}`;
    const err = new Error(errorMsg) as Error & { status: number; details?: unknown };
    err.status = res.status;
    if (!body.success) {
      err.details = body.error.details;
    }
    throw err;
  }

  return body.data;
}

export async function fetchHealth(): Promise<HealthCheckResponse> {
  return request<HealthCheckResponse>('/health');
}

export async function fetchReadiness(): Promise<ReadinessCheckResponse> {
  return request<ReadinessCheckResponse>('/ready');
}

export async function loginUser(
  email: string,
  password = 'Demo@Newtonite2026!'
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentUser(token: string): Promise<UserProfile> {
  return request<UserProfile>('/auth/me', { method: 'GET' }, token);
}

export interface ListItemsParams {
  teamId?: string;
  status?: string;
  priority?: string;
  search?: string;
  limit?: number;
}

export async function fetchWorkItems(
  token: string,
  params: ListItemsParams = {}
): Promise<{ items: WorkItemSummaryDTO[]; hasMore: boolean; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params.teamId) query.set('teamId', params.teamId);
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.priority && params.priority !== 'ALL') query.set('priority', params.priority);
  if (params.search) query.set('search', params.search);
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const path = qs ? `/items?${qs}` : '/items';

  // Directly returns data wrapper
  const res = await request<WorkItemSummaryDTO[]>(path, { method: 'GET' }, token);
  return { items: res, hasMore: false, nextCursor: null };
}

export async function createWorkItem(
  token: string,
  data: {
    teamId: string;
    title: string;
    description?: string;
    type: WorkItemType;
    priority: Priority;
  },
  idempotencyKey?: string
): Promise<WorkItemSummaryDTO> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  return request<WorkItemSummaryDTO>(
    '/items',
    {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    },
    token
  );
}

export async function claimWorkItem(token: string, itemId: string): Promise<WorkItemSummaryDTO> {
  return request<WorkItemSummaryDTO>(
    `/items/${itemId}/claim`,
    {
      method: 'POST',
    },
    token
  );
}

export async function transitionWorkItem(
  token: string,
  itemId: string,
  targetStatus: WorkItemStatus,
  reason?: string
): Promise<WorkItemSummaryDTO> {
  return request<WorkItemSummaryDTO>(
    `/items/${itemId}/transition`,
    {
      method: 'POST',
      body: JSON.stringify({ targetStatus, reason }),
    },
    token
  );
}

export async function fetchItemActivity(
  token: string,
  itemId: string
): Promise<ActivityEventDTO[]> {
  return request<ActivityEventDTO[]>(`/items/${itemId}/activity`, { method: 'GET' }, token);
}

export async function fetchItemComments(token: string, itemId: string): Promise<CommentDTO[]> {
  return request<CommentDTO[]>(`/items/${itemId}/comments`, { method: 'GET' }, token);
}

export async function addComment(token: string, itemId: string, body: string): Promise<CommentDTO> {
  return request<CommentDTO>(
    `/items/${itemId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
    token
  );
}
