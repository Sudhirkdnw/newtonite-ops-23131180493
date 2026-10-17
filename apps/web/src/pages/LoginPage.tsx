import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DEMO_PERSONAS = [
  {
    name: 'Bob Lead',
    email: 'bob.lead@newtonite.dev',
    role: 'LEAD',
    team: 'Core Operations',
    desc: 'Full read/write + approval authority for Review items',
  },
  {
    name: 'Evan Member',
    email: 'evan.member@newtonite.dev',
    role: 'MEMBER',
    team: 'Core Operations',
    desc: 'Can claim, create, edit, and transition items',
  },
  {
    name: 'Ian Viewer',
    email: 'ian.viewer@newtonite.dev',
    role: 'VIEWER',
    team: 'Core Operations',
    desc: 'Read-only access (mutations rejected with HTTP 403)',
  },
  {
    name: 'Alice Admin',
    email: 'alice.admin@newtonite.dev',
    role: 'ADMIN',
    team: 'Platform & Operations',
    desc: 'Superuser with platform-wide administrative scope',
  },
];

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number };
      if (errorObj.status === 401) {
        setErrorMessage('Invalid email or password. Please try again.');
      } else {
        setErrorMessage(errorObj.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemo = async (personaEmail: string) => {
    setEmail(personaEmail);
    setPassword('Demo@Newtonite2026!');
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login(personaEmail, 'Demo@Newtonite2026!');
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setErrorMessage(errorObj.message || 'Demo authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-page)',
        padding: '1.5rem',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-popover)',
          padding: '2.25rem',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary-blue)',
              color: '#ffffff',
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: '0.85rem',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
            }}
          >
            ⚙
          </div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}
          >
            Newtonite Ops
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              marginTop: '0.25rem',
            }}
          >
            Operations Under Pressure — Enterprise Workflow Platform
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="login-error-alert"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            ⚠ {errorMessage}
          </div>
        )}

        {/* Credentials Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label
              htmlFor="login-email"
              style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '0.35rem',
              }}
            >
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@newtonite.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '0.35rem',
              }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', fontSize: '0.875rem' }}
            />
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.7rem',
              backgroundColor: 'var(--primary-blue)',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            margin: '1.75rem 0 1.25rem',
            color: 'var(--text-subtle)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
          <span>Quick Persona Sign-In</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
        </div>

        {/* Seeded Demo Personas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {DEMO_PERSONAS.map((p) => (
            <button
              key={p.email}
              id={`quick-login-${p.role.toLowerCase()}`}
              type="button"
              onClick={() => void handleSelectDemo(p.email)}
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-subtle)',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 750,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      backgroundColor:
                        p.role === 'LEAD'
                          ? '#fef3c7'
                          : p.role === 'ADMIN'
                            ? '#f3e8ff'
                            : p.role === 'VIEWER'
                              ? '#f1f5f9'
                              : '#e0f2fe',
                      color:
                        p.role === 'LEAD'
                          ? '#92400e'
                          : p.role === 'ADMIN'
                            ? '#6b21a8'
                            : p.role === 'VIEWER'
                              ? '#475569'
                              : '#0369a1',
                    }}
                  >
                    {p.role}
                  </span>
                </div>
                <div
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}
                >
                  {p.desc}
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-blue)', fontWeight: 700 }}>
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
