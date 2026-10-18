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
  UpdateWorkItemInput,
  SettingsCategory,
  BrandingSettingsDTO,
  SettingAuditEventDTO,
  OutboxQueueStatsDTO,
  TeamMemberAdminDTO,
  UserSummaryDTO,
  CreateUserAdminInput,
  AddTeamMemberInput,
  AiStatusDTO,
  AiAssistantQueryInput,
  AiAssistantResponseDTO,
  AiDraftEmailInput,
  EmailDraftDTO,
} from '@newtonite/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  systemRole?: 'USER' | 'ADMIN';
  memberships: Array<{
    teamId: string;
    teamName: string;
    teamSlug?: string;
    role: 'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN';
  }>;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface ResponseEnvelope<T> {
  data: T;
  meta?: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

async function requestWithMeta<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<ResponseEnvelope<T>> {
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

  if (!res.ok || !body?.success) {
    const errorMsg =
      body && !body.success && body.error ? body.error.message : `HTTP ${res.status}`;
    const err = new Error(errorMsg) as Error & { status: number; details?: unknown };
    err.status = res.status;
    if (body && !body.success && body.error) {
      err.details = body.error.details;
    }
    throw err;
  }

  return {
    data: body.data,
    meta: body.meta as ResponseEnvelope<T>['meta'],
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const envelope = await requestWithMeta<T>(path, options, token);
  return envelope.data;
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
  type?: string;
  assigneeId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface PaginatedWorkItems {
  items: WorkItemSummaryDTO[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function fetchWorkItems(
  token: string,
  params: ListItemsParams = {}
): Promise<PaginatedWorkItems> {
  const query = new URLSearchParams();
  if (params.teamId) query.set('teamId', params.teamId);
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.priority && params.priority !== 'ALL') query.set('priority', params.priority);
  if (params.type && params.type !== 'ALL') query.set('type', params.type);
  if (params.assigneeId) query.set('assigneeId', params.assigneeId);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const path = qs ? `/items?${qs}` : '/items';

  const envelope = await requestWithMeta<WorkItemSummaryDTO[]>(path, { method: 'GET' }, token);
  return {
    items: envelope.data,
    hasMore: Boolean(envelope.meta?.hasMore),
    nextCursor: envelope.meta?.nextCursor ?? null,
  };
}

export async function fetchWorkItemById(
  token: string,
  itemId: string
): Promise<WorkItemSummaryDTO> {
  return request<WorkItemSummaryDTO>(`/items/${itemId}`, { method: 'GET' }, token);
}

export async function createWorkItem(
  token: string,
  data: {
    teamId: string;
    title: string;
    description?: string;
    type: WorkItemType;
    priority: Priority;
    assigneeId?: string | null;
    dueDate?: string | null;
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

export async function updateWorkItem(
  token: string,
  itemId: string,
  patch: UpdateWorkItemInput,
  idempotencyKey?: string
): Promise<WorkItemSummaryDTO> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  return request<WorkItemSummaryDTO>(
    `/items/${itemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
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

// ==========================================
// Settings & Configuration Center APIs
// ==========================================

export async function fetchPublicBranding(): Promise<BrandingSettingsDTO> {
  return request<BrandingSettingsDTO>('/settings/public/branding');
}

export async function fetchSetting<T>(token: string, category: SettingsCategory): Promise<T> {
  return request<T>(`/settings/${category}`, { method: 'GET' }, token);
}

export async function updateSetting<T>(
  token: string,
  category: SettingsCategory,
  data: Partial<T>
): Promise<T> {
  return request<T>(
    `/settings/${category}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    token
  );
}

export async function uploadBrandingLogo(
  token: string,
  logoData: string
): Promise<{ logoUrl: string }> {
  return request<{ logoUrl: string }>(
    '/settings/branding/logo',
    {
      method: 'POST',
      body: JSON.stringify({ logoData }),
    },
    token
  );
}

export async function testEmailConnection(
  token: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    '/settings/email/test-connection',
    { method: 'POST' },
    token
  );
}

export async function sendTestEmail(
  token: string,
  recipientEmail: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return request<{ success: boolean; messageId?: string; error?: string }>(
    '/settings/email/send-test',
    {
      method: 'POST',
      body: JSON.stringify({ recipientEmail }),
    },
    token
  );
}

export async function fetchTeamsAdmin(token: string) {
  return request<Array<{ id: string; name: string; slug: string; description: string | null }>>(
    '/settings/teams/all',
    { method: 'GET' },
    token
  );
}

export async function fetchTeamMembersAdmin(
  token: string,
  teamId?: string
): Promise<TeamMemberAdminDTO[]> {
  const query = teamId ? `?teamId=${teamId}` : '';
  return request<TeamMemberAdminDTO[]>(`/settings/teams/members${query}`, { method: 'GET' }, token);
}

export async function fetchAllUsersAdmin(
  token: string,
  search?: string
): Promise<UserSummaryDTO[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<UserSummaryDTO[]>(`/settings/users/all${query}`, { method: 'GET' }, token);
}

export async function createUserAdmin(
  token: string,
  data: CreateUserAdminInput
): Promise<UserSummaryDTO> {
  return request<UserSummaryDTO>(
    '/settings/users',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    token
  );
}

export async function addTeamMemberAdmin(
  token: string,
  teamId: string,
  data: AddTeamMemberInput
): Promise<void> {
  await request<void>(
    `/settings/teams/${teamId}/members`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    token
  );
}

export async function updateMemberRoleAdmin(
  token: string,
  teamId: string,
  membershipId: string,
  role: string
): Promise<void> {
  await request<void>(
    `/settings/teams/${teamId}/members/${membershipId}/role`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
    token
  );
}

export async function removeMemberAdmin(
  token: string,
  teamId: string,
  membershipId: string
): Promise<void> {
  await request<void>(
    `/settings/teams/${teamId}/members/${membershipId}`,
    {
      method: 'DELETE',
    },
    token
  );
}

export async function toggleUserActiveAdmin(
  token: string,
  userId: string,
  isActive: boolean
): Promise<void> {
  await request<void>(
    `/settings/users/${userId}/active`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    },
    token
  );
}

export async function fetchQueueStats(token: string): Promise<OutboxQueueStatsDTO> {
  return request<OutboxQueueStatsDTO>('/settings/jobs/stats', { method: 'GET' }, token);
}

export async function retryJob(token: string, jobId: string) {
  return request(`/settings/jobs/${jobId}/retry`, { method: 'POST' }, token);
}

export async function fetchAuditHistory(
  token: string,
  category?: string,
  page = 1,
  limit = 20
): Promise<{ items: SettingAuditEventDTO[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return request(`/settings/audit/history?${params.toString()}`, { method: 'GET' }, token);
}

export async function fetchAiStatus(token: string): Promise<AiStatusDTO> {
  return request<AiStatusDTO>('/ai/status', { method: 'GET' }, token);
}

export async function queryAiAssistant(
  token: string,
  input: AiAssistantQueryInput
): Promise<AiAssistantResponseDTO> {
  return request<AiAssistantResponseDTO>(
    '/ai/assistant',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token
  );
}

export async function draftAiEmail(
  token: string,
  input: AiDraftEmailInput
): Promise<EmailDraftDTO> {
  return request<EmailDraftDTO>(
    '/ai/draft-email',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token
  );
}
