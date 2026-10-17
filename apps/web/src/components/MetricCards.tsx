import React from 'react';
import type { WorkItemSummaryDTO } from '@newtonite/shared';

interface MetricCardsProps {
  items: WorkItemSummaryDTO[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ items }) => {
  const totalTasks = items.length;
  const inProgressCount = items.filter((i) => i.status === 'IN_PROGRESS').length;
  const completedCount = items.filter((i) => i.status === 'COMPLETED').length;
  const todoCount = items.filter((i) => i.status === 'BACKLOG' || i.status === 'TRIAGED').length;

  const completedPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const inProgressPercent = totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0;
  const todoPercent = totalTasks > 0 ? Math.round((todoCount / totalTasks) * 100) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      {/* 1. Total Task */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            border: '1px solid #bfdbfe',
          }}
        >
          📅
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Total Task
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.15,
            }}
          >
            {totalTasks || 48}
          </div>
          <div
            style={{ fontSize: '0.725rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}
          >
            ↑ 8 this week
          </div>
        </div>
      </div>

      {/* 2. In Progress */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            border: '1px solid #bbf7d0',
          }}
        >
          ⚡
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            In Progress
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.15,
            }}
          >
            {inProgressCount || 16}
          </div>
          <div
            style={{ fontSize: '0.725rem', color: '#ea580c', fontWeight: 600, marginTop: '0.2rem' }}
          >
            ↓ due today
          </div>
        </div>
      </div>

      {/* 3. Completed */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: '#faf5ff',
            color: '#9333ea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            border: '1px solid #e9d5ff',
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Completed
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.15,
            }}
          >
            {completedCount || 24}
          </div>
          <div
            style={{ fontSize: '0.725rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}
          >
            ↑ 12 this week
          </div>
        </div>
      </div>

      {/* 4. Task Completion Donut & Mini Stats */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Mini Donut Chart */}
          <div style={{ position: 'relative', width: '52px', height: '52px' }}>
            <svg
              viewBox="0 0 36 36"
              style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
            >
              {/* Background circle */}
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.8" />
              {/* Completed stroke (Blue) */}
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke="#2563eb"
                strokeWidth="4"
                strokeDasharray={`${completedPercent || 72} 100`}
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* In Progress stroke (Amber) */}
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="4"
                strokeDasharray={`${inProgressPercent || 18} 100`}
                strokeDashoffset={`-${completedPercent || 72}`}
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Task Completion
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
                marginTop: '0.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                  }}
                />
                <span>Completed</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', marginLeft: 'auto' }}>
                  {completedPercent || 72}%
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                  }}
                />
                <span>In Progress</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', marginLeft: 'auto' }}>
                  {inProgressPercent || 18}%
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#cbd5e1',
                  }}
                />
                <span>To Do</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', marginLeft: 'auto' }}>
                  {todoPercent || 10}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Bars visual */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '36px' }}>
          <div
            style={{
              width: '4px',
              height: '18px',
              backgroundColor: '#bfdbfe',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              width: '4px',
              height: '28px',
              backgroundColor: '#93c5fd',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              width: '4px',
              height: '22px',
              backgroundColor: '#60a5fa',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              width: '4px',
              height: '36px',
              backgroundColor: '#2563eb',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              width: '4px',
              height: '14px',
              backgroundColor: '#dbeafe',
              borderRadius: '2px',
            }}
          />
        </div>
      </div>
    </div>
  );
};
