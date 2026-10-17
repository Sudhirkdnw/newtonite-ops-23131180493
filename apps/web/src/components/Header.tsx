import React from 'react';
import type { UserProfile } from '../services/api';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenCreateModal: () => void;
  currentUser: UserProfile | null;
  systemReady: boolean | null;
  dbLatency?: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onOpenCreateModal,
  currentUser,
  systemReady,
  dbLatency,
}) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 2rem',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border-color)',
        gap: '1.5rem',
      }}
    >
      {/* Title */}
      <div>
        <h1
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Task
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
          Manage and track your team's operational work
        </p>
      </div>

      {/* Center Search Input */}
      <div style={{ flex: 1, maxWidth: '420px', position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: '0.85rem',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.85rem',
            color: 'var(--text-subtle)',
          }}
        >
          🔍
        </span>
        <input
          id="global-search-input"
          type="text"
          placeholder="Search work items, incidents, tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '2.4rem',
            paddingRight: '1rem',
            paddingTop: '0.55rem',
            paddingBottom: '0.55rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border-color)',
          }}
        />
      </div>

      {/* Right Actions & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* System Health Badge */}
        <div
          title={
            systemReady ? `Database Connected: ${dbLatency}ms latency` : 'Database Unreachable'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.65rem',
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
          <span>{systemReady ? 'ONLINE' : 'DEGRADED'}</span>
        </div>

        {/* Filter Button */}
        <button
          id="btn-filter-trigger"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-main)',
          }}
        >
          <span>⚡</span>
          <span>Filter</span>
        </button>

        {/* Add Task Primary Button */}
        <button
          id="btn-add-task-header"
          onClick={onOpenCreateModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--primary-blue)',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
          }}
        >
          <span>+</span>
          <span>Add Task</span>
        </button>

        {/* Notification Icon */}
        <button
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.95rem',
            color: 'var(--text-muted)',
            backgroundColor: '#ffffff',
          }}
        >
          🔔
        </button>

        {/* User Avatar */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#dbeafe',
            color: 'var(--primary-blue)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            border: '1px solid #bfdbfe',
          }}
        >
          {currentUser?.name.charAt(0) || 'A'}
        </div>
      </div>
    </header>
  );
};
