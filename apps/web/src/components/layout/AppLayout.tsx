import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../ui/Badge';

interface AppLayoutProps {
  currentView: 'dashboard' | 'items' | 'detail' | 'settings';
  setCurrentView: (view: 'dashboard' | 'items' | 'detail' | 'settings') => void;
  systemReady: boolean | null;
  dbLatency?: number;
  onOpenCreate: () => void;
  appName?: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}

const DEMO_PERSONAS = [
  { name: 'Bob Lead', email: 'bob.lead@newtonite.dev', role: 'LEAD' },
  { name: 'Evan Member', email: 'evan.member@newtonite.dev', role: 'MEMBER' },
  { name: 'Ian Viewer', email: 'ian.viewer@newtonite.dev', role: 'VIEWER' },
  { name: 'Alice Admin', email: 'alice.admin@newtonite.dev', role: 'ADMIN' },
];

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  setCurrentView,
  systemReady,
  dbLatency,
  onOpenCreate,
  appName,
  logoUrl,
  children,
}) => {
  const { currentUser, switchPersona, logout } = useAuth();

  const userRole = currentUser?.memberships[0]?.role || 'ADMIN';
  const teamName = currentUser?.memberships[0]?.teamName || 'Platform Ops';

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
          width: '260px',
          minWidth: '260px',
          maxWidth: '260px',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.25rem 1rem',
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
              gap: '0.65rem',
              padding: '0.25rem 0.5rem 1.5rem',
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="App Logo"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  objectFit: 'contain',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-blue)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
                }}
              >
                ⚙
              </div>
            )}
            <div>
              <div
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-main)',
                  lineHeight: 1.2,
                }}
              >
                {appName || 'Newtonite Ops'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Operations Under Pressure
              </div>
            </div>
          </div>

          {/* Primary Navigation Menu */}
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              marginBottom: '2rem',
            }}
          >
            <button
              id="nav-dashboard"
              onClick={() => setCurrentView('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: currentView === 'dashboard' ? 700 : 500,
                backgroundColor:
                  currentView === 'dashboard' ? 'var(--primary-blue)' : 'transparent',
                color: currentView === 'dashboard' ? '#ffffff' : 'var(--text-muted)',
                textAlign: 'left',
              }}
            >
              <span>📊</span>
              <span>Operations Dashboard</span>
            </button>

            <button
              id="nav-work-items"
              onClick={() => setCurrentView('items')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: currentView === 'items' || currentView === 'detail' ? 700 : 500,
                backgroundColor:
                  currentView === 'items' || currentView === 'detail'
                    ? 'var(--primary-blue)'
                    : 'transparent',
                color:
                  currentView === 'items' || currentView === 'detail'
                    ? '#ffffff'
                    : 'var(--text-muted)',
                textAlign: 'left',
              }}
            >
              <span>📋</span>
              <span>Work Items Registry</span>
            </button>

            {userRole === 'ADMIN' && (
              <button
                id="nav-settings"
                onClick={() => setCurrentView('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  fontWeight: currentView === 'settings' ? 750 : 500,
                  backgroundColor:
                    currentView === 'settings' ? 'var(--primary-blue)' : 'transparent',
                  color: currentView === 'settings' ? '#ffffff' : 'var(--text-muted)',
                  textAlign: 'left',
                }}
              >
                <span>⚙️</span>
                <span>System Settings</span>
              </button>
            )}

            <button
              id="nav-quick-create"
              onClick={onOpenCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--primary-blue)',
                textAlign: 'left',
                marginTop: '0.25rem',
              }}
            >
              <span>➕</span>
              <span>New Work Item</span>
            </button>
          </nav>

          {/* Persona Switcher Section */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              border: '1px solid var(--border-color)',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '0.675rem',
                fontWeight: 750,
                textTransform: 'uppercase',
                color: 'var(--text-subtle)',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
              }}
            >
              Active Persona (RBAC)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {DEMO_PERSONAS.map((p) => {
                const isActive = currentUser?.email === p.email;
                return (
                  <button
                    key={p.email}
                    id={`btn-persona-${p.role.toLowerCase()}`}
                    onClick={() => void switchPersona(p.email)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.775rem',
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? 'var(--primary-blue)' : 'var(--text-main)',
                      fontWeight: isActive ? 750 : 500,
                      border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    <span>{p.name}</span>
                    <RoleBadge role={p.role} />
                  </button>
                );
              })}
            </div>
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
              }}
            >
              {currentUser?.name.charAt(0) || 'U'}
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.825rem',
                  fontWeight: 750,
                  color: 'var(--text-main)',
                  lineHeight: 1.2,
                }}
              >
                {currentUser?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
            }}
          >
            Logout
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
            padding: '1rem 2rem',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          {/* Breadcrumb / Section Indicator */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
          >
            <span style={{ color: 'var(--text-subtle)' }}>Newtonite Ops</span>
            <span style={{ color: 'var(--text-subtle)' }}>/</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {currentView === 'dashboard'
                ? 'Operations Dashboard'
                : currentView === 'items'
                  ? 'Work Items Registry'
                  : currentView === 'settings'
                    ? 'Settings & Configuration'
                    : 'Work Item Detail'}
            </span>
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
