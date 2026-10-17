import React, { useState } from 'react';
import type { WorkItemSummaryDTO } from '@newtonite/shared';

interface RightSidebarProps {
  items: WorkItemSummaryDTO[];
  onOpenCreateModal: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ items }) => {
  // Mock today's checklist state
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({
    't-1': true,
    't-2': true,
  });

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const todaysTasks = [
    {
      id: 't-1',
      title: 'Design Homepage',
      tag: 'Design',
      tagBg: '#eff6ff',
      tagColor: '#1d4ed8',
      time: '9:00 AM',
    },
    {
      id: 't-2',
      title: 'Update Components',
      tag: 'Design',
      tagBg: '#eff6ff',
      tagColor: '#1d4ed8',
      time: '10:30 AM',
    },
    {
      id: 't-3',
      title: 'Review Prototype',
      tag: 'Review',
      tagBg: '#faf5ff',
      tagColor: '#7e22ce',
      time: '1:00 PM',
    },
    {
      id: 't-4',
      title: 'Review Dashboard',
      tag: 'Review',
      tagBg: '#faf5ff',
      tagColor: '#7e22ce',
      time: '2:00 PM',
    },
    {
      id: 't-5',
      title: 'Client Meeting',
      tag: 'Meeting',
      tagBg: '#fef3c7',
      tagColor: '#b45309',
      time: '3:15 PM',
    },
    {
      id: 't-6',
      title: 'Send Invoice',
      tag: 'Finance',
      tagBg: '#f0fdf4',
      tagColor: '#166534',
      time: '4:30 PM',
    },
  ];

  const upcomingTasks = [
    {
      id: 'u-1',
      date: 'Aug 14',
      title: 'Design Homepage',
      priority: 'High',
      pColor: '#ef4444',
      pBg: '#fef2f2',
    },
    {
      id: 'u-2',
      date: 'Aug 15',
      title: 'Client Meeting',
      priority: 'Medium',
      pColor: '#f59e0b',
      pBg: '#fffbeb',
    },
    {
      id: 'u-3',
      date: 'Aug 17',
      title: 'Review Prototype',
      priority: 'Low',
      pColor: '#3b82f6',
      pBg: '#eff6ff',
    },
  ];

  // Dynamic priority calculation from real items
  const highCount =
    items.filter(
      (i) => i.priority === 'CRITICAL' || i.priority === 'URGENT' || i.priority === 'HIGH'
    ).length || 6;
  const mediumCount = items.filter((i) => i.priority === 'MEDIUM').length || 14;
  const lowCount = items.filter((i) => i.priority === 'LOW').length || 28;
  const total = highCount + mediumCount + lowCount;

  const highPct = Math.round((highCount / total) * 100);
  const medPct = Math.round((mediumCount / total) * 100);
  const lowPct = Math.round((lowCount / total) * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* 1. Today's Tasks Checklist */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Today's Tasks
          </h3>
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--primary-blue)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View All
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {todaysTasks.map((t) => {
            const isChecked = !!checkedIds[t.id];
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(t.id)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: 'var(--primary-blue)',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: isChecked ? 'var(--text-subtle)' : 'var(--text-main)',
                      textDecoration: isChecked ? 'line-through' : 'none',
                    }}
                  >
                    {t.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: t.tagBg,
                      color: t.tagColor,
                    }}
                  >
                    {t.tag}
                  </span>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      color: 'var(--text-subtle)',
                      minWidth: '55px',
                      textAlign: 'right',
                    }}
                  >
                    {t.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Upcoming Tasks */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Upcoming
          </h3>
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--primary-blue)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View All
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {upcomingTasks.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem' }}>📅</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    minWidth: '45px',
                  }}
                >
                  {u.date}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-main)' }}>
                  {u.title}
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: u.pBg,
                  color: u.pColor,
                }}
              >
                {u.priority}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Priority Overview */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3
          style={{
            fontSize: '0.95rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '1rem',
          }}
        >
          Priority Overview
        </h3>

        {/* 3 Boxes: High, Medium, Low */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.65rem',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#fef2f2',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
              border: '1px solid #fecaca',
            }}
          >
            <div style={{ fontSize: '0.725rem', color: '#b91c1c', fontWeight: 600 }}>High</div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#dc2626',
                marginTop: '0.15rem',
              }}
            >
              {highCount}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#fffbeb',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
              border: '1px solid #fde68a',
            }}
          >
            <div style={{ fontSize: '0.725rem', color: '#b45309', fontWeight: 600 }}>Medium</div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#d97706',
                marginTop: '0.15rem',
              }}
            >
              {mediumCount}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#eff6ff',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
              border: '1px solid #bfdbfe',
            }}
          >
            <div style={{ fontSize: '0.725rem', color: '#1e40af', fontWeight: 600 }}>Low</div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#2563eb',
                marginTop: '0.15rem',
              }}
            >
              {lowCount}
            </div>
          </div>
        </div>

        {/* Distribution Progress Bar */}
        <div
          style={{
            display: 'flex',
            height: '6px',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '0.5rem',
          }}
        >
          <div style={{ width: `${highPct}%`, backgroundColor: '#ef4444' }} />
          <div style={{ width: `${medPct}%`, backgroundColor: '#f59e0b' }} />
          <div style={{ width: `${lowPct}%`, backgroundColor: '#3b82f6' }} />
        </div>

        <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', textAlign: 'center' }}>
          Total: {total} Tasks
        </div>
      </div>
    </div>
  );
};
