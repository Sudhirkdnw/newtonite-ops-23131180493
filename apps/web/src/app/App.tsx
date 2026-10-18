import React, { useState, useEffect, useCallback } from 'react';
import {
  type WorkItemSummaryDTO,
  type WorkItemStatus,
  type CreateWorkItemInput,
  type UpdateWorkItemInput,
  type BrandingSettingsDTO,
  DEFAULT_NEWTONITE_LOGO,
} from '@newtonite/shared';
import {
  claimWorkItem,
  transitionWorkItem,
  createWorkItem,
  updateWorkItem,
  fetchReadiness,
  fetchPublicBranding,
} from '../services/api';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppLayout, type SettingsTab } from '../components/layout/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkItemsPage } from '../pages/WorkItemsPage';
import { WorkItemDetailPage } from '../pages/WorkItemDetailPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TeamListPage } from '../pages/TeamListPage';
import { AiAssistantPage } from '../pages/AiAssistantPage';
import { WorkItemFormModal } from '../components/WorkItemFormModal';
import { TransitionModal } from '../components/TransitionModal';
import { ToastContainer, type ToastMessage } from '../components/ui/Toast';

const DashboardAppContent: React.FC = () => {
  const { token, currentUser, isLoading: isAuthLoading } = useAuth();

  // Navigation state
  const [currentView, setCurrentView] = useState<
    'dashboard' | 'items' | 'detail' | 'teams' | 'settings' | 'assistant'
  >('dashboard');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const handleSelectSettingsTab = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab);
    setCurrentView('settings');
  }, []);

  // Dynamic Branding State with persistent localStorage cache
  const [branding, setBranding] = useState<BrandingSettingsDTO>(() => {
    try {
      const cached = localStorage.getItem('newtonite_branding_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return {
            ...parsed,
            logoUrl:
              parsed.logoUrl && parsed.logoUrl !== 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
                ? parsed.logoUrl
                : DEFAULT_NEWTONITE_LOGO,
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      appName: 'Newtonite Ops',
      logoUrl: DEFAULT_NEWTONITE_LOGO,
      faviconUrl: null,
      browserTitle: 'Newtonite Ops — Operations Under Pressure',
      primaryColor: '#2563eb',
      accentColor: '#1d4ed8',
      themeDefault: 'light',
      sidebarTheme: 'light',
    };
  });

  // System Health
  const [systemReady, setSystemReady] = useState<boolean | null>(null);
  const [dbLatency, setDbLatency] = useState<number | undefined>(undefined);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkItemSummaryDTO | null>(null);

  const [transitioningItem, setTransitioningItem] = useState<WorkItemSummaryDTO | null>(null);

  const addToast = useCallback(
    (type: ToastMessage['type'], message: string, title?: string, details?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, message, title, details }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 7000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Apply branding dynamically to DOM and CSS custom variables
  const applyBranding = useCallback((b: BrandingSettingsDTO) => {
    const finalLogo =
      b.logoUrl && b.logoUrl !== 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
        ? b.logoUrl
        : DEFAULT_NEWTONITE_LOGO;
    const finalBranding: BrandingSettingsDTO = { ...b, logoUrl: finalLogo };

    setBranding(finalBranding);
    try {
      localStorage.setItem('newtonite_branding_cache', JSON.stringify(finalBranding));
    } catch {
      // ignore
    }

    if (finalBranding.browserTitle) {
      document.title = finalBranding.browserTitle;
    }
    if (finalBranding.primaryColor) {
      document.documentElement.style.setProperty('--primary-blue', finalBranding.primaryColor);
    }
    if (finalBranding.accentColor) {
      document.documentElement.style.setProperty('--primary-blue-hover', finalBranding.accentColor);
    }
  }, []);

  // Initial public branding load
  useEffect(() => {
    async function loadBranding() {
      try {
        const b = await fetchPublicBranding();
        if (b) {
          applyBranding(b);
        }
      } catch {
        // Fallback to default
      }
    }
    void loadBranding();
  }, [applyBranding]);

  // System health poll
  useEffect(() => {
    async function checkHealth() {
      try {
        const r = await fetchReadiness();
        setSystemReady(r.status === 'ready');
        setDbLatency(r.latencyMs);
      } catch {
        setSystemReady(false);
      }
    }
    void checkHealth();
    const interval = setInterval(() => void checkHealth(), 15000);
    return () => clearInterval(interval);
  }, []);

  // Select item to view detail
  const handleSelectItem = useCallback((item: WorkItemSummaryDTO) => {
    setSelectedItemId(item.id);
    setCurrentView('detail');
  }, []);

  // Open Create modal
  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setIsFormModalOpen(true);
  }, []);

  // Open Edit modal
  const handleOpenEdit = useCallback((item: WorkItemSummaryDTO) => {
    setEditingItem(item);
    setIsFormModalOpen(true);
  }, []);

  // Open Transition modal
  const handleOpenTransition = useCallback((item: WorkItemSummaryDTO) => {
    setTransitioningItem(item);
  }, []);

  // Atomic Claim Handler with optimistic update & 409 conflict detection
  const handleClaimItem = useCallback(
    async (item: WorkItemSummaryDTO) => {
      if (!token || !currentUser) return;

      try {
        const updated = await claimWorkItem(token, item.id);
        addToast(
          'success',
          `Successfully claimed "${updated.title}" (Version v${updated.version})`
        );
      } catch (err: unknown) {
        const errorObj = err as {
          status?: number;
          message?: string;
          details?: { claimedBy?: string; currentVersion?: number };
        };

        if (errorObj.status === 409) {
          addToast(
            'conflict',
            errorObj.message || 'Work item was already claimed by another user.',
            '409 Conflict: Concurrent Claim Rejected',
            errorObj.details?.claimedBy
              ? `Currently assigned to: ${errorObj.details.claimedBy}`
              : undefined
          );
        } else if (errorObj.status === 403) {
          addToast(
            'forbidden',
            'Viewers hold read-only permissions and cannot claim work items.',
            '403 Forbidden: Action Denied'
          );
        } else {
          addToast('error', errorObj.message || 'Failed to claim work item.');
        }
        throw err;
      }
    },
    [token, currentUser, addToast]
  );

  // Transition Handler with Lead approval validation
  const handleConfirmTransition = useCallback(
    async (itemId: string, targetStatus: WorkItemStatus, reason?: string) => {
      if (!token) return;

      try {
        const updated = await transitionWorkItem(token, itemId, targetStatus, reason);
        addToast(
          'success',
          `Status transitioned to ${targetStatus.replace('_', ' ')} (Version v${updated.version})`
        );
      } catch (err: unknown) {
        const errorObj = err as { status?: number; message?: string };
        if (errorObj.status === 403) {
          addToast(
            'forbidden',
            'Workflow approval requires Lead or Admin authority. Members cannot approve items in review.',
            '403 Forbidden: Workflow Approval Required'
          );
        } else {
          addToast('error', errorObj.message || 'Transition rejected by workflow state machine.');
        }
        throw err;
      }
    },
    [token, addToast]
  );

  // Create Work Item Handler
  const handleCreateSubmit = useCallback(
    async (data: CreateWorkItemInput, idempotencyKey: string) => {
      if (!token) return;

      try {
        const created = await createWorkItem(token, data, idempotencyKey);
        addToast('success', `Created work item "${created.title}" (v1)`);
        // Navigate to detail or refresh
        setSelectedItemId(created.id);
        setCurrentView('detail');
      } catch (err: unknown) {
        const errorObj = err as { status?: number; message?: string };
        if (errorObj.status === 403) {
          addToast('forbidden', 'Viewers do not have permission to create work items.');
        } else {
          addToast('error', errorObj.message || 'Failed to create work item.');
        }
        throw err;
      }
    },
    [token, addToast]
  );

  // Update Work Item Handler with optimistic concurrency control
  const handleUpdateSubmit = useCallback(
    async (itemId: string, patch: UpdateWorkItemInput, idempotencyKey: string) => {
      if (!token) return;

      try {
        const updated = await updateWorkItem(token, itemId, patch, idempotencyKey);
        addToast('success', `Updated "${updated.title}" (v${updated.version})`);
      } catch (err: unknown) {
        const errorObj = err as { status?: number; message?: string };
        if (errorObj.status === 409) {
          addToast(
            'conflict',
            'Stale update rejected: This work item has been modified by another concurrent user. Please refresh.',
            '409 Conflict: Version Mismatch'
          );
        } else if (errorObj.status === 403) {
          addToast('forbidden', 'You do not have permission to modify this work item.');
        } else {
          addToast('error', errorObj.message || 'Failed to update work item.');
        }
        throw err;
      }
    },
    [token, addToast]
  );

  // If loading authentication state, show centered spinner
  if (isAuthLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-page)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        Initializing secure operational environment...
      </div>
    );
  }

  // Route protection: if unauthenticated, render LoginPage
  if (!currentUser || !token) {
    return <LoginPage />;
  }

  return (
    <>
      <AppLayout
        currentView={currentView}
        setCurrentView={setCurrentView}
        activeSettingsTab={settingsTab}
        onSelectSettingsTab={handleSelectSettingsTab}
        systemReady={systemReady}
        dbLatency={dbLatency}
        onOpenCreate={handleOpenCreate}
        appName={branding?.appName}
        logoUrl={branding?.logoUrl}
      >
        {currentView === 'dashboard' && (
          <DashboardPage
            onSelectItem={handleSelectItem}
            onOpenCreate={handleOpenCreate}
            onClaimItem={handleClaimItem}
          />
        )}

        {currentView === 'items' && (
          <WorkItemsPage
            onSelectItem={handleSelectItem}
            onOpenCreate={handleOpenCreate}
            onClaimItem={handleClaimItem}
            onOpenTransition={handleOpenTransition}
            onOpenEdit={handleOpenEdit}
          />
        )}

        {currentView === 'detail' && selectedItemId && (
          <WorkItemDetailPage
            itemId={selectedItemId}
            onBack={() => setCurrentView('items')}
            onClaimItem={handleClaimItem}
            onOpenTransition={handleOpenTransition}
            onOpenEdit={handleOpenEdit}
          />
        )}

        {currentView === 'teams' && <TeamListPage onNotify={addToast} />}

        {currentView === 'settings' && (
          <SettingsPage
            initialTab={settingsTab}
            onNotify={addToast}
            onBrandingUpdated={applyBranding}
          />
        )}

        {currentView === 'assistant' && (
          <AiAssistantPage
            onSelectItem={(id: string) => {
              setSelectedItemId(id);
              setCurrentView('detail');
            }}
            onNavigateSettings={() => handleSelectSettingsTab('ai')}
            onNotify={(type, message, title) => addToast(type, message, title)}
          />
        )}
      </AppLayout>

      {/* Create / Edit Work Item Modal */}
      <WorkItemFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmitCreate={handleCreateSubmit}
        onSubmitUpdate={handleUpdateSubmit}
        initialItem={editingItem}
      />

      {/* State Transition Modal */}
      <TransitionModal
        isOpen={Boolean(transitioningItem)}
        item={transitioningItem}
        onClose={() => setTransitioningItem(null)}
        onConfirm={handleConfirmTransition}
        userRole={currentUser.memberships[0]?.role}
      />

      {/* Toast Alert Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <DashboardAppContent />
    </AuthProvider>
  );
};

export default App;
