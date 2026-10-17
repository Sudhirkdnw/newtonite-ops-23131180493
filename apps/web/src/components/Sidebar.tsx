import React from 'react';
import type { UserProfile } from '../services/api';

interface SidebarProps {
  currentUser: UserProfile | null;
  onSwitchPersona: (email: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const DEMO_PERSONAS = [
  {
    name: 'Bob Lead',
    email: 'bob.lead@newtonite.dev',
    role: 'LEAD',
    team: 'Core Operations',
    avatar: '👨‍💼',
  },
  {
    name: 'Evan Member',
    email: 'evan.member@newtonite.dev',
    role: 'MEMBER',
    team: 'Core Operations',
    avatar: '👨‍💻',
  },
  {
    name: 'Ian Viewer',
    email: 'ian.viewer@newtonite.dev',
    role: 'VIEWER',
    team: 'Core Operations',
    avatar: '👁️',
  },
  {
    name: 'Alice Admin',
    email: 'alice.admin@newtonite.dev',
    role: 'ADMIN',
    team: 'Platform Ops',
    avatar: '👩‍💼',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  onSwitchPersona,
  activeTab,
  setActiveTab,
}) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: '🏠' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'tasks', label: 'Tasks', icon: '☑️' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'team', label: 'Team', icon: '👥' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside
      style={{
        width: '240px',
        minWidth: '240px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.25rem 1rem',
        minHeight: '100vh',
      }}
    >
      <div>
        {/* Brand / Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0 0.5rem 1.5rem',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              backgroundColor: 'var(--primary-blue)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
            }}
          >
            ⚙
          </div>
          <span
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
            }}
          >
            Workspace
          </span>
        </div>

        {/* Navigation Menu */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            marginBottom: '1.5rem',
          }}
        >
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive ? 'var(--primary-blue)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Demo Roles / Persona Switcher Section */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            marginBottom: '1rem',
            border: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-subtle)',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem',
            }}
          >
            Switch Role (RBAC)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {DEMO_PERSONAS.map((p) => {
              const isCurrent = currentUser?.email === p.email;
              return (
                <button
                  key={p.email}
                  id={`switch-${p.role.toLowerCase()}`}
                  onClick={() => onSwitchPersona(p.email)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    backgroundColor: isCurrent ? '#ffffff' : 'transparent',
                    color: isCurrent ? 'var(--primary-blue)' : 'var(--text-main)',
                    fontWeight: isCurrent ? 700 : 500,
                    boxShadow: isCurrent ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    border: isCurrent ? '1px solid var(--border-color)' : '1px solid transparent',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{p.avatar}</span>
                    <span>{p.name.split(' ')[0]}</span>
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      backgroundColor: isCurrent ? 'var(--primary-blue-light)' : '#e2e8f0',
                      color: isCurrent ? 'var(--primary-blue)' : 'var(--text-muted)',
                    }}
                  >
                    {p.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upgrade Plan Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            border: '1px solid #bfdbfe',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🚀</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Upgrade Plan
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Unlock premium features & concurrency stress testing.
          </div>
          <button
            style={{
              width: '100%',
              padding: '0.45rem',
              backgroundColor: 'var(--primary-blue)',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 650,
              borderRadius: '6px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
            }}
          >
            Upgrade Now
          </button>
        </div>
      </div>

      {/* User Profile Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 0.5rem 0',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--primary-blue)',
              border: '2px solid #ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            {currentUser?.name.charAt(0) || 'U'}
          </div>
          <div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                lineHeight: 1.2,
              }}
            >
              {currentUser?.name || 'Loading...'}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              {currentUser?.memberships[0]?.role || 'USER'} •{' '}
              {currentUser?.memberships[0]?.teamName || 'Ops'}
            </div>
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>▼</span>
      </div>
    </aside>
  );
};
