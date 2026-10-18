import React from 'react';
import { useAuth } from '../../context/AuthContext';

export type SettingsTab =
  | 'general'
  | 'branding'
  | 'email'
  | 'sla'
  | 'ai'
  | 'teams'
  | 'security'
  | 'workflow'
  | 'notifications'
  | 'jobs'
  | 'audit';

interface AppLayoutProps {
  currentView: 'dashboard' | 'items' | 'detail' | 'teams' | 'settings' | 'assistant';
  setCurrentView: (
    view: 'dashboard' | 'items' | 'detail' | 'teams' | 'settings' | 'assistant'
  ) => void;
  activeSettingsTab?: SettingsTab;
  onSelectSettingsTab?: (tab: SettingsTab) => void;
  systemReady: boolean | null;
  dbLatency?: number;
  onOpenCreate: () => void;
  appName?: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}

/* Professional SVG Icons (Lucide / Feather style) */
const IconDashboard: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const IconTasks: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const IconTeams: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconNotification: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconAssistant: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M9 13v2" />
    <path d="M15 13v2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
  </svg>
);

const IconSettings: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconPlus: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  setCurrentView,
  activeSettingsTab = 'general',
  onSelectSettingsTab,
  systemReady,
  dbLatency,
  onOpenCreate,
  appName,
  logoUrl,
  children,
}) => {
  const { currentUser, logout } = useAuth();

  const userRole = currentUser?.memberships[0]?.role || 'ADMIN';
  const teamName = currentUser?.memberships[0]?.teamName || 'Platform Ops';

  // Navigation handlers
  const handleNavDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleNavTasks = () => {
    setCurrentView('items');
  };

  const handleNavTeams = () => {
    setCurrentView('teams');
  };

  const handleNavNotifications = () => {
    if (onSelectSettingsTab) {
      onSelectSettingsTab('notifications');
    } else {
      setCurrentView('settings');
    }
  };

  const handleNavAssistant = () => {
    setCurrentView('assistant');
  };

  const handleNavSettings = () => {
    if (onSelectSettingsTab) {
      onSelectSettingsTab('general');
    } else {
      setCurrentView('settings');
    }
  };

  // Determine active item
  const isDashboardActive = currentView === 'dashboard';
  const isTasksActive = currentView === 'items' || currentView === 'detail';
  const isTeamsActive = currentView === 'teams';
  const isNotificationsActive = currentView === 'settings' && activeSettingsTab === 'notifications';
  const isAssistantActive = currentView === 'assistant';
  const isSettingsActive = currentView === 'settings' && activeSettingsTab !== 'notifications';

  // Breadcrumb title calculation
  const getHeaderTitle = () => {
    if (currentView === 'dashboard') return 'Dashboard';
    if (currentView === 'items') return 'My Tasks';
    if (currentView === 'detail') return 'Task Details';
    if (currentView === 'teams') return 'Team Directory & Personnel';
    if (currentView === 'assistant') return 'AI Operations Assistant';
    if (currentView === 'settings') {
      if (activeSettingsTab === 'notifications') return 'Notifications & SLA Alerts';
      if (activeSettingsTab === 'email') return 'Communication & Email Relay';
      return 'System Settings';
    }
    return 'Operations';
  };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0.625rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: isActive ? 650 : 500,
    backgroundColor: isActive ? 'var(--primary-blue-light)' : 'transparent',
    color: isActive ? 'var(--primary-blue)' : 'var(--text-muted)',
    border: 'none',
    borderLeft: isActive ? '3px solid var(--primary-blue)' : '3px solid transparent',
    transition: 'all 0.15s ease-in-out',
    textAlign: 'left',
  });

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-page)',
      }}
    >
      {/* Left Sidebar */}
      <aside
        style={{
          width: '264px',
          minWidth: '264px',
          maxWidth: '264px',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.25rem 1rem 1rem 1rem',
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div>
          {/* Logo & Brand Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.25rem 0.35rem 1.25rem 0.35rem',
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="App Logo"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  objectFit: 'contain',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-blue)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
                }}
              >
                ⚙
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-main)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {appName || 'Newtonite Ops'}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                }}
              >
                Operations Platform
              </div>
            </div>
          </div>

          {/* Primary Action Button: + New Work Item */}
          <button
            id="nav-quick-create"
            onClick={onOpenCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.55rem',
              width: '100%',
              padding: '0.625rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 650,
              backgroundColor: 'var(--primary-blue)',
              color: '#ffffff',
              boxShadow: '0 2px 6px -1px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease',
              marginBottom: '1.25rem',
            }}
          >
            <IconPlus size={16} />
            <span>New Work Item</span>
          </button>

          {/* Main Navigation Menu */}
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* 1. Dashboard */}
            <button
              id="nav-dashboard"
              onClick={handleNavDashboard}
              style={navItemStyle(isDashboardActive)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <IconDashboard />
                <span>Dashboard</span>
              </div>
            </button>

            {/* 2. My Tasks */}
            <button
              id="nav-work-items"
              onClick={handleNavTasks}
              style={navItemStyle(isTasksActive)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <IconTasks />
                <span>My Task</span>
              </div>
            </button>

            {/* 3. Team List */}
            <button id="nav-team-list" onClick={handleNavTeams} style={navItemStyle(isTeamsActive)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <IconTeams />
                <span>Team List</span>
              </div>
            </button>

            {/* 4. Notification */}
            <button
              id="nav-notifications"
              onClick={handleNavNotifications}
              style={navItemStyle(isNotificationsActive)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <IconNotification />
                <span>Notification</span>
              </div>
            </button>

            {/* 6. AI Operations Assistant */}
            <button
              id="nav-assistant"
              onClick={handleNavAssistant}
              style={navItemStyle(isAssistantActive)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <IconAssistant />
                <span>AI Assistant</span>
              </div>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: isAssistantActive ? 'var(--primary-blue)' : '#e0e7ff',
                  color: isAssistantActive ? '#ffffff' : '#3730a3',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  letterSpacing: '0.02em',
                }}
              >
                PRO
              </span>
            </button>

            {/* 7. Setting */}
            {userRole === 'ADMIN' && (
              <button
                id="nav-settings"
                onClick={handleNavSettings}
                style={navItemStyle(isSettingsActive)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <IconSettings />
                  <span>Setting</span>
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* User Profile & Logout Footer */}
        <div
          style={{
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              minWidth: 0,
              maxWidth: '170px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-blue-light)',
                color: 'var(--primary-blue)',
                fontWeight: 800,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #bfdbfe',
                flexShrink: 0,
              }}
            >
              {currentUser?.name.charAt(0) || 'U'}
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '0.825rem',
                  fontWeight: 750,
                  color: 'var(--text-main)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentUser?.name || 'User'}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {userRole} • {teamName}
              </div>
            </div>
          </div>

          <button
            id="btn-logout"
            onClick={logout}
            title="Sign Out"
            style={{
              padding: '0.35rem 0.55rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 650,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>Exit</span>
          </button>
        </div>
      </aside>

      {/* Main App Workspace */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Top Header Navbar */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 2rem',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          {/* Breadcrumb / Section Indicator */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
          >
            <span style={{ color: 'var(--text-subtle)' }}>{appName || 'Newtonite Ops'}</span>
            <span style={{ color: 'var(--text-subtle)' }}>/</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{getHeaderTitle()}</span>
          </div>

          {/* Right Header Badges & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* System Health Pulse */}
            <div
              title={systemReady ? `Database Online: ${dbLatency}ms latency` : 'Database Degraded'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: systemReady ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${systemReady ? '#a7f3d0' : '#fecaca'}`,
                fontSize: '0.75rem',
                fontWeight: 700,
                color: systemReady ? '#065f46' : '#991b1b',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: systemReady ? '#10b981' : '#ef4444',
                }}
              />
              <span>
                {systemReady
                  ? `ONLINE${dbLatency !== undefined ? ` (${dbLatency}ms)` : ''}`
                  : 'DEGRADED'}
              </span>
            </div>

            {/* Quick Create Action */}
            <button
              id="header-btn-create-item"
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
        </header>

        {/* Dynamic Page Content */}
        <main style={{ padding: '2rem', flex: 1 }}>{children}</main>
      </div>
    </div>
  );
};
