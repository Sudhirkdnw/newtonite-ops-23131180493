import React, { useEffect, useState, useCallback } from 'react';
import type { WorkItemSummaryDTO } from '@newtonite/shared';
import { fetchWorkItems } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { CardSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

interface DashboardPageProps {
  onSelectItem: (item: WorkItemSummaryDTO) => void;
  onOpenCreate: () => void;
  onClaimItem: (item: WorkItemSummaryDTO) => Promise<void>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onSelectItem,
  onOpenCreate,
  onClaimItem,
}) => {
  const { token, currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 5 Operational Queues
  const [assignedToMe, setAssignedToMe] = useState<WorkItemSummaryDTO[]>([]);
  const [unassignedUrgent, setUnassignedUrgent] = useState<WorkItemSummaryDTO[]>([]);
  const [awaitingApproval, setAwaitingApproval] = useState<WorkItemSummaryDTO[]>([]);
  const [recentItems, setRecentItems] = useState<WorkItemSummaryDTO[]>([]);
  const [attentionRequired, setAttentionRequired] = useState<WorkItemSummaryDTO[]>([]);

  const loadDashboardData = useCallback(async () => {
    if (!token || !currentUser) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch recent items across accessible teams (limit 50 to populate queues)
      const res = await fetchWorkItems(token, { limit: 50 });
      const allItems = res.items;

      // Section 1: Assigned to Me
      const myItems = allItems.filter(
        (i) =>
          i.assigneeId === currentUser.id && i.status !== 'COMPLETED' && i.status !== 'CANCELLED'
      );
      setAssignedToMe(myItems);

      // Section 2: Unassigned Urgent (CRITICAL or URGENT with no assignee)
      const urgentUnassigned = allItems.filter(
        (i) =>
          !i.assigneeId &&
          (i.priority === 'CRITICAL' || i.priority === 'URGENT') &&
          i.status !== 'COMPLETED' &&
          i.status !== 'CANCELLED'
      );
      setUnassignedUrgent(urgentUnassigned);

      // Section 3: Awaiting My Approval (IN_REVIEW in teams where user has LEAD or ADMIN role)
      const leadTeamIds = new Set(
        currentUser.memberships
          .filter((m) => m.role === 'LEAD' || m.role === 'ADMIN')
          .map((m) => m.teamId)
      );
      const approvalItems = allItems.filter(
        (i) => i.status === 'IN_REVIEW' && leadTeamIds.has(i.teamId)
      );
      setAwaitingApproval(approvalItems);

      // Section 4: Recent Work Items (all latest items)
      setRecentItems(allItems.slice(0, 10));

      // Section 5: Work Requiring Attention (BLOCKED items or unassigned backlog)
      const attention = allItems.filter(
        (i) => i.status === 'BLOCKED' || (i.status === 'BACKLOG' && !i.assigneeId)
      );
      setAttentionRequired(attention);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load dashboard operational queues');
    } finally {
      setIsLoading(false);
    }
  }, [token, currentUser]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const renderItemCard = (item: WorkItemSummaryDTO, showClaim = false) => {
    const isUnassigned = !item.assigneeId;

    return (
      <div
        key={item.id}
        id={`dashboard-item-${item.id}`}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '1rem',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onClick={() => onSelectItem(item)}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <PriorityBadge priority={item.priority} />
              <StatusBadge status={item.status} />
            </div>
            <span
              style={{
                fontSize: '0.675rem',
                fontFamily: 'var(--font-code)',
                fontWeight: 700,
                color: 'var(--text-subtle)',
                backgroundColor: '#f1f5f9',
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
              }}
            >
              v{item.version}
            </span>
          </div>

          <h4
            style={{
              fontSize: '0.9rem',
              fontWeight: 750,
              color: 'var(--text-main)',
              lineHeight: 1.35,
              marginBottom: '0.35rem',
            }}
          >
            {item.title}
          </h4>

          {item.description && (
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                lineHeight: 1.4,
                marginBottom: '0.65rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>{item.teamName || 'Core Team'}</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {showClaim && isUnassigned && currentUser?.memberships[0]?.role !== 'VIEWER' && (
              <button
                id={`btn-claim-${item.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void onClaimItem(item);
                }}
                style={{
                  padding: '0.2rem 0.6rem',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                }}
              >
                ⚡ Claim
              </button>
            )}
            <span
              style={{
                fontWeight: 650,
                color: item.assigneeName ? 'var(--text-main)' : 'var(--text-subtle)',
              }}
            >
              {item.assigneeName || 'Unassigned'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}
          >
            Operations Command Dashboard
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Real-time server queues filtered by your security persona and active team assignments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => void loadDashboardData()}
            disabled={isLoading}
            style={{
              padding: '0.45rem 0.85rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 650,
              color: 'var(--text-muted)',
            }}
          >
            ↻ Refresh Queues
          </button>
          <button
            id="btn-dashboard-new-item"
            onClick={onOpenCreate}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: 'var(--primary-blue)',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
            }}
          >
            + Create Work Item
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Error loading operational data:</strong> {error}
          </div>
          <button
            onClick={() => void loadDashboardData()}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: '#dc2626',
              color: '#fff',
              borderRadius: '4px',
              fontWeight: 650,
              fontSize: '0.75rem',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <CardSkeleton count={4} />}

      {!isLoading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Section 1: Assigned to Me */}
          <section id="section-assigned-to-me">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.85rem',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                1. Assigned to Me
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                }}
              >
                {assignedToMe.length}
              </span>
            </div>

            {assignedToMe.length === 0 ? (
              <EmptyState
                icon="✓"
                title="No items assigned to you"
                description="You have no pending active work items assigned to your persona. Check Unassigned Urgent or the Work Items registry."
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {assignedToMe.map((item) => renderItemCard(item))}
              </div>
            )}
          </section>

          {/* Section 2: Unassigned Urgent */}
          <section id="section-unassigned-urgent">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.85rem',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#dc2626' }}>
                2. Unassigned Urgent
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                }}
              >
                {unassignedUrgent.length}
              </span>
            </div>

            {unassignedUrgent.length === 0 ? (
              <EmptyState
                icon="🛡️"
                title="No urgent unassigned items"
                description="All critical and urgent operational items are actively assigned and being handled."
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {unassignedUrgent.map((item) => renderItemCard(item, true))}
              </div>
            )}
          </section>

          {/* Section 3: Awaiting My Approval */}
          <section id="section-awaiting-approval">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.85rem',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#7e22ce' }}>
                3. Awaiting My Approval (Lead Review)
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: '#f3e8ff',
                  color: '#6b21a8',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                }}
              >
                {awaitingApproval.length}
              </span>
            </div>

            {awaitingApproval.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No items awaiting your approval"
                description={
                  currentUser?.memberships.some((m) => m.role === 'LEAD' || m.role === 'ADMIN')
                    ? 'No work items are currently pending Lead approval in your accessible teams.'
                    : 'Your active persona does not hold Lead approval authority. Items in review require Bob Lead or Alice Admin approval.'
                }
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {awaitingApproval.map((item) => renderItemCard(item))}
              </div>
            )}
          </section>

          {/* Section 4: Work Requiring Attention */}
          <section id="section-attention-required">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.85rem',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#d97706' }}>
                4. Work Requiring Attention
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                }}
              >
                {attentionRequired.length}
              </span>
            </div>

            {attentionRequired.length === 0 ? (
              <EmptyState
                icon="✓"
                title="No blocked items"
                description="Zero items are marked BLOCKED or sitting untriaged in the backlog."
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {attentionRequired.map((item) => renderItemCard(item, true))}
              </div>
            )}
          </section>

          {/* Section 5: Recent Work Items */}
          <section id="section-recent-items">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.85rem',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                5. Recent Work Items (Operational Audit Stream)
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                }}
              >
                {recentItems.length}
              </span>
            </div>

            {recentItems.length === 0 ? (
              <EmptyState
                icon="📁"
                title="No recent items found"
                description="No items have been registered in the system yet. Click 'Create Work Item' above to start."
                actionText="+ Create First Work Item"
                onAction={onOpenCreate}
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {recentItems.map((item) => renderItemCard(item))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
