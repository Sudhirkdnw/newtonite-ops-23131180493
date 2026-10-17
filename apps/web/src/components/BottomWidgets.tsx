import React from 'react';
import type { ActivityEventDTO } from '@newtonite/shared';

interface BottomWidgetsProps {
  recentActivities?: ActivityEventDTO[];
  onOpenDrawer?: () => void;
}

export const BottomWidgets: React.FC<BottomWidgetsProps> = ({ recentActivities = [] }) => {
  // Built-in recent activities fallback to match mockup visual exactly
  const displayActivities =
    recentActivities.length > 0
      ? recentActivities.slice(0, 4).map((a) => ({
          time: new Date(a.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          actor: a.actorName || 'Team Member',
          avatar: '👨‍💼',
          desc: `${a.actorName || 'User'} performed ${a.action.replace('_', ' ')}`,
          ago: new Date(a.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          color: '#2563eb',
        }))
      : [
          {
            time: '09:20',
            actor: 'Alex Johnson',
            avatar: '👨‍💼',
            desc: "Alex moved 'Dashboard UI' → In Progress",
            ago: '2m ago',
            color: '#2563eb',
          },
          {
            time: '10:15',
            actor: 'Sarah Miller',
            avatar: '👩‍💻',
            desc: "Sarah completed 'Wireframe'",
            ago: '15m ago',
            color: '#16a34a',
          },
          {
            time: '11:40',
            actor: 'Mike Chen',
            avatar: '👨‍💻',
            desc: "Mike added comment to 'Mobile App Layout'",
            ago: '1h ago',
            color: '#8b5cf6',
          },
          {
            time: '13:10',
            actor: 'Emma Davis',
            avatar: '👩‍💼',
            desc: 'Emma changed Priority → High',
            ago: '3h ago',
            color: '#ea580c',
          },
        ];

  const teamMembers = [
    { name: 'Alex Johnson', avatar: '👨‍💼', pct: 80 },
    { name: 'Sarah Miller', avatar: '👩‍💻', pct: 65 },
    { name: 'Mike Chen', avatar: '👨‍💻', pct: 48 },
    { name: 'Emma Davis', avatar: '👩‍💼', pct: 72 },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {/* 1. Task Timeline (Recent Activity) */}
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
            Task Timeline (Recent Activity)
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
          {displayActivities.map((act, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-subtle)',
                    minWidth: '42px',
                  }}
                >
                  {act.time}
                </span>

                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: act.color,
                  }}
                />

                <span style={{ fontSize: '0.9rem' }}>{act.avatar}</span>

                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {act.desc}
                </span>
              </div>

              <span
                style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}
              >
                {act.ago}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Team Workload Widget */}
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
            Team Workload
          </h3>

          <select
            defaultValue="This Week"
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.45rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              fontWeight: 600,
              color: 'var(--text-main)',
            }}
          >
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Members list with capacity progress bars */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {teamMembers.map((m) => (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.9rem' }}>{m.avatar}</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    minWidth: '85px',
                  }}
                >
                  {m.name}
                </span>

                <div
                  style={{
                    flex: 1,
                    height: '6px',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${m.pct}%`,
                      height: '100%',
                      backgroundColor: 'var(--primary-blue)',
                      borderRadius: '3px',
                    }}
                  />
                </div>

                <span
                  style={{
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    minWidth: '32px',
                    textAlign: 'right',
                  }}
                >
                  {m.pct}%
                </span>
              </div>
            ))}
          </div>

          {/* Donut Chart on Right: 65% Capacity */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '100px',
            }}
          >
            <div style={{ position: 'relative', width: '64px', height: '64px' }}>
              <svg
                viewBox="0 0 36 36"
                style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
              >
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="4"
                  strokeDasharray="65 100"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  65%
                </span>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Capacity
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: '0.45rem',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              <div>• Available: 35%</div>
              <div>• Utilized: 65%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
