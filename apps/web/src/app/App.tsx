import React, { useEffect, useState } from 'react';
import { fetchHealth, fetchReadiness } from '../services/api';
import type { HealthCheckResponse, ReadinessCheckResponse } from '@newtonite/shared';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        setLoading(true);
        const [h, r] = await Promise.all([fetchHealth(), fetchReadiness()]);
        setHealth(h);
        setReadiness(r);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to API');
      } finally {
        setLoading(false);
      }
    }

    void checkStatus();
  }, []);

  return (
    <div className="container">
      <header
        style={{
          marginBottom: '2.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
              }}
            >
              Newtonite Operations Platform
            </h1>
            <p
              style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.95rem' }}
            >
              Operations Under Pressure — High-Reliability Workflow Engine
            </p>
          </div>
          <span
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor:
                readiness?.status === 'ready'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              color: readiness?.status === 'ready' ? 'var(--color-success)' : 'var(--color-danger)',
              border: `1px solid ${readiness?.status === 'ready' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            {loading
              ? 'CHECKING...'
              : readiness?.status === 'ready'
                ? 'SYSTEM OPERATIONAL'
                : 'SYSTEM DEGRADED'}
          </span>
        </div>
      </header>

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            System Infrastructure Status
          </h2>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Querying backend endpoints...</p>}
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-danger)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
              }}
            >
              <strong>Connection Error:</strong> {error}
            </div>
          )}
          {health && readiness && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.9rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>API Service:</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                  {health.status.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Database (PostgreSQL):</span>
                <span
                  style={{
                    color:
                      readiness.database === 'connected'
                        ? 'var(--color-success)'
                        : 'var(--color-danger)',
                    fontWeight: 600,
                  }}
                >
                  {readiness.database.toUpperCase()} ({readiness.latencyMs}ms)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Environment:</span>
                <span style={{ color: 'var(--text-primary)' }}>{health.environment}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Server Uptime:</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {Math.floor(health.uptimeSeconds)}s
                </span>
              </div>
            </div>
          )}
        </section>

        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Step 1 Foundation Capabilities
          </h2>
          <ul
            style={{
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              fontSize: '0.9rem',
            }}
          >
            <li style={{ color: 'var(--color-success)' }}>
              ✓ Production Monorepo &amp; Strict TypeScript
            </li>
            <li style={{ color: 'var(--color-success)' }}>
              ✓ PostgreSQL Schema with Optimistic Locking (`version`)
            </li>
            <li style={{ color: 'var(--color-success)' }}>
              ✓ Append-Only Activity Log &amp; Outbox Job Table
            </li>
            <li style={{ color: 'var(--color-success)' }}>
              ✓ Idempotency Key Storage &amp; Response Caching Schema
            </li>
            <li style={{ color: 'var(--color-success)' }}>
              ✓ Centralized Error Handling &amp; Request ID Tracing
            </li>
            <li style={{ color: 'var(--color-muted)' }}>○ Step 2: Authentication &amp; JWT Flow</li>
            <li style={{ color: 'var(--color-muted)' }}>
              ○ Step 3: Concurrent Claim &amp; Optimistic Locking API
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default App;
