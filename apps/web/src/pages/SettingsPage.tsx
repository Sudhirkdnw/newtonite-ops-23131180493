import React, { useState, useEffect, useCallback } from 'react';
import {
  type SettingsCategory,
  type GeneralSettingsDTO,
  type BrandingSettingsDTO,
  type EmailSettingsDTO,
  type SlaSettingsDTO,
  type WorkflowSettingsDTO,
  type SecuritySettingsDTO,
  type NotificationSettingsDTO,
  type SettingAuditEventDTO,
  type OutboxQueueStatsDTO,
  type TeamMemberAdminDTO,
} from '@newtonite/shared';
import {
  fetchSetting,
  updateSetting,
  uploadBrandingLogo,
  testEmailConnection,
  sendTestEmail,
  fetchTeamsAdmin,
  fetchTeamMembersAdmin,
  updateMemberRoleAdmin,
  removeMemberAdmin,
  toggleUserActiveAdmin,
  fetchQueueStats,
  retryJob,
  fetchAuditHistory,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from '../components/ui/Badge';
import { CardSkeleton } from '../components/ui/LoadingSkeleton';

type SettingsTab =
  | 'general'
  | 'branding'
  | 'email'
  | 'sla'
  | 'teams'
  | 'security'
  | 'workflow'
  | 'notifications'
  | 'jobs'
  | 'audit';

interface SettingsPageProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
  onBrandingUpdated?: (branding: BrandingSettingsDTO) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNotify, onBrandingUpdated }) => {
  const { token, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Section States
  const [general, setGeneral] = useState<GeneralSettingsDTO | null>(null);
  const [branding, setBranding] = useState<BrandingSettingsDTO | null>(null);
  const [email, setEmail] = useState<EmailSettingsDTO | null>(null);
  const [sla, setSla] = useState<SlaSettingsDTO | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowSettingsDTO | null>(null);
  const [security, setSecurity] = useState<SecuritySettingsDTO | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettingsDTO | null>(null);

  // Teams & Access Control State
  const [teams, setTeams] = useState<
    Array<{ id: string; name: string; slug: string; description: string | null }>
  >([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberAdminDTO[]>([]);

  // Jobs & Health State
  const [queueStats, setQueueStats] = useState<OutboxQueueStatsDTO | null>(null);

  // Audit State
  const [auditEvents, setAuditEvents] = useState<SettingAuditEventDTO[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);

  // Test Email Modal
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState(currentUser?.email || '');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailConnTesting, setEmailConnTesting] = useState(false);

  // Check if current user has admin rights
  const isAdmin =
    currentUser?.systemRole === 'ADMIN' || currentUser?.memberships.some((m) => m.role === 'ADMIN');

  // Load data for active tab
  const loadTabContent = useCallback(async () => {
    if (!token || !isAdmin) return;
    setIsLoading(true);

    try {
      if (activeTab === 'general') {
        const data = await fetchSetting<GeneralSettingsDTO>(token, 'general');
        setGeneral(data);
      } else if (activeTab === 'branding') {
        const data = await fetchSetting<BrandingSettingsDTO>(token, 'branding');
        setBranding(data);
      } else if (activeTab === 'email') {
        const data = await fetchSetting<EmailSettingsDTO>(token, 'email');
        setEmail(data);
      } else if (activeTab === 'sla') {
        const data = await fetchSetting<SlaSettingsDTO>(token, 'sla');
        setSla(data);
      } else if (activeTab === 'teams') {
        const [teamsList, membersList] = await Promise.all([
          fetchTeamsAdmin(token),
          fetchTeamMembersAdmin(token, selectedTeamId || undefined),
        ]);
        setTeams(teamsList);
        setTeamMembers(membersList);
      } else if (activeTab === 'security') {
        const data = await fetchSetting<SecuritySettingsDTO>(token, 'security');
        setSecurity(data);
      } else if (activeTab === 'workflow') {
        const data = await fetchSetting<WorkflowSettingsDTO>(token, 'workflow');
        setWorkflow(data);
      } else if (activeTab === 'notifications') {
        const data = await fetchSetting<NotificationSettingsDTO>(token, 'notification');
        setNotifications(data);
      } else if (activeTab === 'jobs') {
        const stats = await fetchQueueStats(token);
        setQueueStats(stats);
      } else if (activeTab === 'audit') {
        const audit = await fetchAuditHistory(token);
        setAuditEvents(audit.items);
        setAuditTotal(audit.total);
      }
      setHasUnsavedChanges(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load configuration';
      onNotify('error', msg, 'Configuration Error');
    } finally {
      setIsLoading(false);
    }
  }, [token, isAdmin, activeTab, selectedTeamId, onNotify]);

  useEffect(() => {
    void loadTabContent();
  }, [loadTabContent]);

  // Tab switch with unsaved changes guard
  const handleTabSwitch = (tab: SettingsTab) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard and switch section?')) {
        return;
      }
    }
    setActiveTab(tab);
  };

  // Generic Save Handler
  const handleSave = async (category: SettingsCategory, payload: Record<string, unknown>) => {
    if (!token) return;
    setIsSaving(true);

    try {
      const updated = await updateSetting(token, category, payload);
      onNotify(
        'success',
        `${category.toUpperCase()} settings saved successfully`,
        'Settings Saved'
      );
      setHasUnsavedChanges(false);

      if (category === 'branding' && onBrandingUpdated) {
        onBrandingUpdated(updated as BrandingSettingsDTO);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save operation failed';
      onNotify('error', msg, 'Save Error');
    } finally {
      setIsSaving(false);
    }
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      onNotify('error', 'Image size must be less than 2MB', 'File Too Large');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      if (token) {
        try {
          await uploadBrandingLogo(token, base64);
          setBranding((prev) => (prev ? { ...prev, logoUrl: base64 } : prev));
          onNotify('success', 'Logo uploaded successfully', 'Branding Asset');
          if (branding && onBrandingUpdated) {
            onBrandingUpdated({ ...branding, logoUrl: base64 });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          onNotify('error', msg, 'Upload Error');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Test Email Connection Action
  const handleTestConnection = async () => {
    if (!token) return;
    setEmailConnTesting(true);
    try {
      const res = await testEmailConnection(token);
      if (res.success) {
        onNotify('success', res.message, 'SMTP Connection Verified');
      } else {
        onNotify('error', res.message, 'SMTP Connection Failed');
      }
      void loadTabContent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      onNotify('error', msg, 'Connection Test Error');
    } finally {
      setEmailConnTesting(false);
    }
  };

  // Send Test Email Action
  const handleSendTestEmail = async () => {
    if (!token || !testEmailRecipient) return;
    setIsTestingEmail(true);
    try {
      const res = await sendTestEmail(token, testEmailRecipient);
      if (res.success) {
        onNotify('success', `Test email dispatched to ${testEmailRecipient}`, 'Delivery Verified');
        setIsTestEmailOpen(false);
      } else {
        onNotify('error', res.error || 'Delivery failed', 'Dispatch Failed');
      }
      void loadTabContent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send test email';
      onNotify('error', msg, 'Send Email Error');
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Outbox retry handler
  const handleRetryJob = async (jobId: string) => {
    if (!token) return;
    try {
      await retryJob(token, jobId);
      onNotify('success', 'Job rescheduled for immediate background execution', 'Job Retried');
      void loadTabContent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retry job';
      onNotify('error', msg, 'Retry Failed');
    }
  };

  if (!isAdmin) {
    return (
      <div
        style={{
          padding: '3rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Access Restricted
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Administrative privileges are required to view and manage System Settings.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Settings Header */}
      <div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
          }}
        >
          Settings & Configuration Center
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Manage global application parameters, operational commitments, appearance, integrations,
          and RBAC governance.
        </p>
      </div>

      {/* Main Tabbed Layout Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left Sub-Section Navigation */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {[
            { id: 'general', label: 'General', icon: '⚙️' },
            { id: 'branding', label: 'Branding & Appearance', icon: '🎨' },
            { id: 'email', label: 'Email Configuration', icon: '✉️' },
            { id: 'sla', label: 'SLA & Escalation', icon: '⏱️' },
            { id: 'teams', label: 'Teams & Access Control', icon: '👥' },
            { id: 'security', label: 'Security & Sessions', icon: '🔒' },
            { id: 'workflow', label: 'Workflow Defaults', icon: '📋' },
            { id: 'notifications', label: 'Notifications', icon: '🔔' },
            { id: 'jobs', label: 'Background Jobs & Health', icon: '🔄' },
            { id: 'audit', label: 'Audit Log & History', icon: '📜' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                onClick={() => handleTabSwitch(tab.id as SettingsTab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.825rem',
                  fontWeight: isActive ? 750 : 500,
                  backgroundColor: isActive ? 'var(--primary-blue-light)' : 'transparent',
                  color: isActive ? 'var(--primary-blue)' : 'var(--text-main)',
                  border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                  textAlign: 'left',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Active Tab Content Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            padding: '1.75rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)',
            minHeight: '400px',
          }}
        >
          {isLoading ? (
            <CardSkeleton />
          ) : (
            <>
              {/* TAB 1: GENERAL */}
              {activeTab === 'general' && general && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave('general', general);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      General System Parameters
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Core organizational identity, timezone, and emergency operational states.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Application Name
                      </label>
                      <input
                        type="text"
                        value={general.appName}
                        onChange={(e) => {
                          setGeneral({ ...general, appName: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={general.orgName}
                        onChange={(e) => {
                          setGeneral({ ...general, orgName: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        System Timezone
                      </label>
                      <select
                        value={general.timezone}
                        onChange={(e) => {
                          setGeneral({ ...general, timezone: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="UTC">UTC (Universal Coordinated)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Date Format
                      </label>
                      <select
                        value={general.dateFormat}
                        onChange={(e) => {
                          setGeneral({
                            ...general,
                            dateFormat: e.target.value as GeneralSettingsDTO['dateFormat'],
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (Standard)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Time Format
                      </label>
                      <select
                        value={general.timeFormat}
                        onChange={(e) => {
                          setGeneral({
                            ...general,
                            timeFormat: e.target.value as GeneralSettingsDTO['timeFormat'],
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="24h">24 Hours (Military/Ops)</option>
                        <option value="12h">12 Hours (AM/PM)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: '0.35rem',
                      }}
                    >
                      Support Contact Email
                    </label>
                    <input
                      type="email"
                      value={general.supportContact}
                      onChange={(e) => {
                        setGeneral({ ...general, supportContact: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Maintenance Mode Box */}
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: general.maintenanceMode ? '#fef2f2' : 'var(--bg-subtle)',
                      border: `1px solid ${general.maintenanceMode ? '#fca5a5' : 'var(--border-color)'}`,
                      marginTop: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            color: general.maintenanceMode ? '#991b1b' : 'var(--text-main)',
                          }}
                        >
                          ⚠️ Maintenance Mode
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          When enabled, non-administrators are blocked from creating or modifying
                          work items (HTTP 503).
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        id="chk-maintenance-mode"
                        checked={general.maintenanceMode}
                        onChange={(e) => {
                          setGeneral({ ...general, maintenanceMode: e.target.checked });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.75rem',
                      marginTop: '1rem',
                    }}
                  >
                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: 'var(--primary-blue)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 750,
                        fontSize: '0.85rem',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save General Settings'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: BRANDING & APPEARANCE */}
              {activeTab === 'branding' && branding && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave('branding', branding);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Branding & Appearance</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Customize portal brand name, browser title, logo assets, and primary theme
                      colors.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Portal Display Title
                      </label>
                      <input
                        type="text"
                        value={branding.appName}
                        onChange={(e) => {
                          setBranding({ ...branding, appName: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Browser Tab Title
                      </label>
                      <input
                        type="text"
                        value={branding.browserTitle}
                        onChange={(e) => {
                          setBranding({ ...branding, browserTitle: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Colors & Swatches */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Primary Brand Color
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={branding.primaryColor}
                          onChange={(e) => {
                            setBranding({ ...branding, primaryColor: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          style={{ width: '40px', height: '36px', padding: 0, cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          value={branding.primaryColor}
                          onChange={(e) => {
                            setBranding({ ...branding, primaryColor: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Accent Color
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={branding.accentColor}
                          onChange={(e) => {
                            setBranding({ ...branding, accentColor: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          style={{ width: '40px', height: '36px', padding: 0, cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          value={branding.accentColor}
                          onChange={(e) => {
                            setBranding({ ...branding, accentColor: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload Section */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: '0.35rem',
                      }}
                    >
                      Brand Logo (PNG, JPEG, SVG, WEBP - Max 2MB)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {branding.logoUrl ? (
                        <img
                          src={branding.logoUrl}
                          alt="Logo Preview"
                          style={{
                            width: '48px',
                            height: '48px',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '8px',
                            backgroundColor: branding.primaryColor,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                          }}
                        >
                          ⚙
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoUpload}
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  {/* Live Preview Box */}
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 750,
                        color: 'var(--text-subtle)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      LIVE HEADER PREVIEW
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {branding.logoUrl ? (
                          <img
                            src={branding.logoUrl}
                            alt="Logo"
                            style={{ width: '28px', height: '28px' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: branding.primaryColor,
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                            }}
                          >
                            ⚙
                          </div>
                        )}
                        <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                          {branding.appName}
                        </span>
                      </div>
                      <button
                        type="button"
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: branding.primaryColor,
                          color: '#fff',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        Sample Action
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: 'var(--primary-blue)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 750,
                        fontSize: '0.85rem',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save Branding'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: EMAIL CONFIGURATION */}
              {activeTab === 'email' && email && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave('email', email);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                          Outbound Email Configuration
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Configure SMTP relay settings for escalation alerts, notifications, and
                          verification.
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 750,
                          backgroundColor:
                            email.lastTestResult === 'SUCCESS'
                              ? '#dcfce7'
                              : email.lastTestResult === 'FAILED'
                                ? '#fee2e2'
                                : '#f1f5f9',
                          color:
                            email.lastTestResult === 'SUCCESS'
                              ? '#166534'
                              : email.lastTestResult === 'FAILED'
                                ? '#991b1b'
                                : '#64748b',
                        }}
                      >
                        {email.lastTestResult === 'SUCCESS'
                          ? '✓ Transport Operational'
                          : email.lastTestResult === 'FAILED'
                            ? '✕ Last Connection Failed'
                            : '○ Not Tested'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        SMTP Host Server
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. smtp.mailgun.org, smtp.sendgrid.net"
                        value={email.smtpHost}
                        onChange={(e) => {
                          setEmail({ ...email, smtpHost: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Port
                      </label>
                      <input
                        type="number"
                        value={email.smtpPort}
                        onChange={(e) => {
                          setEmail({ ...email, smtpPort: parseInt(e.target.value, 10) || 587 });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        value={email.smtpUser}
                        onChange={(e) => {
                          setEmail({ ...email, smtpUser: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        SMTP Password (Leave blank to preserve saved secret)
                      </label>
                      <input
                        type="password"
                        placeholder={email.smtpPassword ? '••••••••' : 'Enter new password'}
                        value={email.smtpPassword === '••••••••' ? '' : email.smtpPassword || ''}
                        onChange={(e) => {
                          setEmail({ ...email, smtpPassword: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Sender Name
                      </label>
                      <input
                        type="text"
                        value={email.senderName}
                        onChange={(e) => {
                          setEmail({ ...email, senderName: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Sender Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="alerts@yourdomain.com"
                        value={email.senderEmail}
                        onChange={(e) => {
                          setEmail({ ...email, senderEmail: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '1.5rem',
                      alignItems: 'center',
                      marginTop: '0.5rem',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={email.smtpSecure}
                        onChange={(e) => {
                          setEmail({ ...email, smtpSecure: e.target.checked });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>Use TLS / SSL Secure Connection</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={email.enabled}
                        onChange={(e) => {
                          setEmail({ ...email, enabled: e.target.checked });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>Enable Outbound Email Delivery</span>
                    </label>
                  </div>

                  {email.lastTestError && (
                    <div
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#fef2f2',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #fecaca',
                        fontSize: '0.75rem',
                        color: '#991b1b',
                      }}
                    >
                      <strong>Last Error:</strong> {email.lastTestError}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={emailConnTesting || !email.smtpHost}
                        style={{
                          padding: '0.55rem 1rem',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        {emailConnTesting ? 'Verifying...' : '⚡ Test Connection'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsTestEmailOpen(true)}
                        disabled={!email.smtpHost}
                        style={{
                          padding: '0.55rem 1rem',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        ✉ Send Test Email
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: 'var(--primary-blue)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 750,
                        fontSize: '0.85rem',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save Email Settings'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 4: SLA & ESCALATION */}
              {activeTab === 'sla' && sla && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave('sla', sla);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      SLA & Escalation Policies
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Define priority commitment windows, proactive warning buffers, and background
                      scanning intervals.
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '0.75rem',
                    }}
                  >
                    {[
                      { key: 'CRITICAL', label: 'Critical Priority', defaultH: 2 },
                      { key: 'URGENT', label: 'Urgent Priority', defaultH: 6 },
                      { key: 'HIGH', label: 'High Priority', defaultH: 24 },
                      { key: 'MEDIUM', label: 'Medium Priority', defaultH: 72 },
                      { key: 'LOW', label: 'Low Priority', defaultH: 168 },
                    ].map((p) => {
                      const minutes =
                        sla.durations[p.key as keyof typeof sla.durations] || p.defaultH * 60;
                      const hours = Math.round((minutes / 60) * 10) / 10;
                      return (
                        <div
                          key={p.key}
                          style={{
                            padding: '0.75rem',
                            backgroundColor: 'var(--bg-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              marginBottom: '0.35rem',
                            }}
                          >
                            {p.label}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="number"
                              min={15}
                              max={43200}
                              value={minutes}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 15;
                                setSla({
                                  ...sla,
                                  durations: {
                                    ...sla.durations,
                                    [p.key]: val,
                                  },
                                });
                                setHasUnsavedChanges(true);
                              }}
                              style={{ width: '100%', fontSize: '0.85rem' }}
                            />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              min
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.65rem',
                              color: 'var(--text-muted)',
                              marginTop: '0.25rem',
                            }}
                          >
                            ≈ {hours} hours
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '1rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        At-Risk Warning Threshold (%)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={50}
                        value={sla.warningBufferPercent}
                        onChange={(e) => {
                          setSla({
                            ...sla,
                            warningBufferPercent: parseInt(e.target.value, 10) || 25,
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.2rem',
                        }}
                      >
                        Items transition to AT_RISK when remaining time is ≤ this percentage of SLA
                        duration.
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Escalation Scan Interval (Minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={sla.scanIntervalMinutes}
                        onChange={(e) => {
                          setSla({
                            ...sla,
                            scanIntervalMinutes: parseInt(e.target.value, 10) || 5,
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.2rem',
                        }}
                      >
                        Frequency of background worker SLA scans and transactional outbox
                        escalations.
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 750 }}>
                        Enable Background Escalation Processing
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        If disabled, background workers will pause SLA scans without losing
                        configured policies.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={sla.escalationProcessingEnabled}
                      onChange={(e) => {
                        setSla({ ...sla, escalationProcessingEnabled: e.target.checked });
                        setHasUnsavedChanges(true);
                      }}
                      style={{ width: '18px', height: '18px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: 'var(--primary-blue)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 750,
                        fontSize: '0.85rem',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save SLA Policies'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 5: TEAMS & ACCESS CONTROL */}
              {activeTab === 'teams' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      Teams & Access Control (RBAC)
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Manage organizational teams, assign roles, and administer member accounts with
                      last-admin safeguards.
                    </p>
                  </div>

                  {/* Filter by Team */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Filter Team:</label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      style={{ maxWidth: '300px' }}
                    >
                      <option value="">All Operational Teams</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Members Table */}
                  <div
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-subtle)',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border-color)',
                          }}
                        >
                          <th style={{ padding: '0.65rem 1rem' }}>User</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Team</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Current Role</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamMembers.map((m) => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 750 }}>{m.userName}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {m.userEmail}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>{m.teamName}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <RoleBadge role={m.role} />
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  backgroundColor: m.userIsActive ? '#dcfce7' : '#fee2e2',
                                  color: m.userIsActive ? '#166534' : '#991b1b',
                                }}
                              >
                                {m.userIsActive ? 'Active' : 'Deactivated'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.5rem',
                                  justifyContent: 'flex-end',
                                }}
                              >
                                {/* Role selector */}
                                <select
                                  value={m.role}
                                  onChange={async (e) => {
                                    if (!token) return;
                                    try {
                                      await updateMemberRoleAdmin(
                                        token,
                                        m.teamId,
                                        m.id,
                                        e.target.value
                                      );
                                      onNotify(
                                        'success',
                                        `Updated ${m.userName} to ${e.target.value}`,
                                        'Role Updated'
                                      );
                                      void loadTabContent();
                                    } catch (err: unknown) {
                                      const msg =
                                        err instanceof Error ? err.message : 'Role update failed';
                                      onNotify('error', msg, 'Update Error');
                                    }
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  <option value="VIEWER">VIEWER</option>
                                  <option value="MEMBER">MEMBER</option>
                                  <option value="LEAD">LEAD</option>
                                  <option value="ADMIN">ADMIN</option>
                                </select>

                                {/* Active toggle */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!token) return;
                                    try {
                                      await toggleUserActiveAdmin(token, m.userId, !m.userIsActive);
                                      onNotify(
                                        'success',
                                        `User account ${m.userIsActive ? 'deactivated' : 'activated'}`,
                                        'Status Changed'
                                      );
                                      void loadTabContent();
                                    } catch (err: unknown) {
                                      const msg =
                                        err instanceof Error ? err.message : 'Status update failed';
                                      onNotify('error', msg, 'Status Error');
                                    }
                                  }}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {m.userIsActive ? 'Deactivate' : 'Activate'}
                                </button>

                                {/* Remove button */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (
                                      !token ||
                                      !window.confirm(
                                        `Remove ${m.userName} from team ${m.teamName}?`
                                      )
                                    )
                                      return;
                                    try {
                                      await removeMemberAdmin(token, m.teamId, m.id);
                                      onNotify(
                                        'success',
                                        `Removed ${m.userName} from team`,
                                        'Member Removed'
                                      );
                                      void loadTabContent();
                                    } catch (err: unknown) {
                                      const msg =
                                        err instanceof Error ? err.message : 'Removal failed';
                                      onNotify('error', msg, 'Removal Error');
                                    }
                                  }}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#fee2e2',
                                    color: '#991b1b',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: SECURITY & SESSIONS */}
              {activeTab === 'security' && security && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave('security', security);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      Security & Authentication Policies
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Password complexity rules and session duration parameters.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Session Expiry Timeout (Minutes)
                      </label>
                      <input
                        type="number"
                        min={15}
                        max={1440}
                        value={security.sessionTimeoutMinutes}
                        onChange={(e) => {
                          setSecurity({
                            ...security,
                            sessionTimeoutMinutes: parseInt(e.target.value, 10) || 60,
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Minimum Password Length
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={32}
                        value={security.minPasswordLength}
                        onChange={(e) => {
                          setSecurity({
                            ...security,
                            minPasswordLength: parseInt(e.target.value, 10) || 8,
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={security.requireSpecialChar}
                        onChange={(e) => {
                          setSecurity({ ...security, requireSpecialChar: e.target.checked });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>Require at least one special character (!@#$%^&*)</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={security.requireNumber}
                        onChange={(e) => {
                          setSecurity({ ...security, requireNumber: e.target.checked });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>Require at least one numeric digit (0-9)</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: 'var(--primary-blue)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 750,
                        fontSize: '0.85rem',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save Security Policy'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 7: WORKFLOW DEFAULTS */}
              {activeTab === 'workflow' && workflow && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave('workflow', workflow);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      Workflow & Work Item Defaults
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Initial values and constraints applied when creating operational items.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Default Priority
                      </label>
                      <select
                        value={workflow.defaultPriority}
                        onChange={(e) => {
                          setWorkflow({
                            ...workflow,
                            defaultPriority: e.target
                              .value as WorkflowSettingsDTO['defaultPriority'],
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Default Item Type
                      </label>
                      <select
                        value={workflow.defaultType}
                        onChange={(e) => {
                          setWorkflow({
                            ...workflow,
                            defaultType: e.target.value as WorkflowSettingsDTO['defaultType'],
                          });
                          setHasUnsavedChanges(true);
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="TASK">TASK</option>
                        <option value="INCIDENT">INCIDENT</option>
                        <option value="CUSTOMER_ISSUE">CUSTOMER_ISSUE</option>
                        <option value="PAYMENT">PAYMENT</option>
                        <option value="COMPLIANCE">COMPLIANCE</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={workflow.requireDueDateForCritical}
                        onChange={(e) => {
                          setWorkflow({ ...workflow, requireDueDateForCritical: e.target.checked });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>Enforce required Due Date for CRITICAL priority items</span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={workflow.allowViewerComments}
                        onChange={(e) => {
                          setWorkflow({ ...workflow, allowViewerComments: e.target.checked });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>
                        Allow Viewer role to read comments (Mutations remain Lead/Member only)
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: 'var(--primary-blue)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 750,
                        fontSize: '0.85rem',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save Workflow Defaults'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 8: NOTIFICATIONS */}
              {activeTab === 'notifications' && notifications && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave('notification', notifications);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      Notification Preferences
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Control automated alerts dispatched through the transactional outbox pipeline.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={notifications.emailNotificationsEnabled}
                        onChange={(e) => {
                          setNotifications({
                            ...notifications,
                            emailNotificationsEnabled: e.target.checked,
                          });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>
                        <strong>Master Email Notification Delivery</strong> (Dispatches outbound
                        messages via outbox)
                      </span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={notifications.notifyOnEscalation}
                        onChange={(e) => {
                          setNotifications({
                            ...notifications,
                            notifyOnEscalation: e.target.checked,
                          });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>
                        Dispatch notification when an item reaches <strong>AT_RISK</strong> or{' '}
                        <strong>BREACHED</strong> SLA
                      </span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={notifications.notifyOnAssignment}
                        onChange={(e) => {
                          setNotifications({
                            ...notifications,
                            notifyOnAssignment: e.target.checked,
                          });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>
                        Dispatch notification when an item is claimed or assigned to an operator
                      </span>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={notifications.notifyOnApproval}
                        onChange={(e) => {
                          setNotifications({
                            ...notifications,
                            notifyOnApproval: e.target.checked,
                          });
                          setHasUnsavedChanges(true);
                        }}
                      />
                      <span>
                        Dispatch notification when a Lead approves an item from Review to Completed
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: 'var(--primary-blue)',
                        color: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 750,
                        fontSize: '0.85rem',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save Notification Settings'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 9: BACKGROUND JOBS & HEALTH */}
              {activeTab === 'jobs' && queueStats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      Background Jobs & Queue Health
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Transactional Outbox queue states, failure metrics, and manual retry triggers.
                    </p>
                  </div>

                  {/* Queue Metric Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '0.75rem',
                    }}
                  >
                    {[
                      {
                        label: 'Pending',
                        count: queueStats.pending,
                        color: '#2563eb',
                        bg: '#eff6ff',
                      },
                      {
                        label: 'Processing',
                        count: queueStats.processing,
                        color: '#d97706',
                        bg: '#fffbeb',
                      },
                      {
                        label: 'Completed',
                        count: queueStats.completed,
                        color: '#16a34a',
                        bg: '#f0fdf4',
                      },
                      {
                        label: 'Failed',
                        count: queueStats.failed,
                        color: '#dc2626',
                        bg: '#fef2f2',
                      },
                      {
                        label: 'Dead Letter',
                        count: queueStats.deadLetter,
                        color: '#7c3aed',
                        bg: '#faf5ff',
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: s.bg,
                          border: `1px solid ${s.color}20`,
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>
                          {s.count}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent Failures List */}
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                      Recent Failed Outbox Jobs
                    </h3>
                    {queueStats.recentFailures.length === 0 ? (
                      <div
                        style={{
                          padding: '1.5rem',
                          backgroundColor: 'var(--bg-subtle)',
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        ✓ No failed or dead-letter outbox jobs. All background processes healthy.
                      </div>
                    ) : (
                      <div
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                        }}
                      >
                        <table
                          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: 'var(--bg-subtle)',
                                borderBottom: '1px solid var(--border-color)',
                              }}
                            >
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                                Event Type
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                                Target ID
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                                Attempts
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                                Last Error
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {queueStats.recentFailures.map((job) => (
                              <tr
                                key={job.id}
                                style={{ borderBottom: '1px solid var(--border-color)' }}
                              >
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>
                                  {job.eventType}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>
                                  {job.aggregateId}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  {job.attempts} / {job.maxAttempts}
                                </td>
                                <td
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    color: '#991b1b',
                                    maxWidth: '300px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {job.lastError || 'Unknown Error'}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryJob(job.id)}
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      backgroundColor: 'var(--primary-blue)',
                                      color: '#fff',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    Retry Job
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 10: AUDIT LOG & HISTORY */}
              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                          Configuration Audit Trail
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Append-only historical log of all administrative changes with redacted
                          secrets.
                        </p>
                      </div>
                      <span
                        style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}
                      >
                        Total Events: {auditTotal}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-subtle)',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border-color)',
                          }}
                        >
                          <th style={{ padding: '0.65rem 1rem' }}>Timestamp</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Category</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Action</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Actor</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Audit Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditEvents.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              style={{
                                padding: '2rem',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                              }}
                            >
                              No configuration audit events recorded yet.
                            </td>
                          </tr>
                        ) : (
                          auditEvents.map((e) => (
                            <tr
                              key={e.id}
                              style={{ borderBottom: '1px solid var(--border-color)' }}
                            >
                              <td
                                style={{
                                  padding: '0.75rem 1rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {new Date(e.createdAt).toLocaleString()}
                              </td>
                              <td
                                style={{
                                  padding: '0.75rem 1rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {e.category}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    backgroundColor: '#f1f5f9',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  {e.action}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 700 }}>{e.actorName || 'System'}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {e.actorEmail || 'Internal'}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem' }}>
                                <details style={{ cursor: 'pointer' }}>
                                  <summary
                                    style={{ color: 'var(--primary-blue)', fontWeight: 600 }}
                                  >
                                    View Safe Diff
                                  </summary>
                                  <pre
                                    style={{
                                      backgroundColor: 'var(--bg-subtle)',
                                      padding: '0.5rem',
                                      borderRadius: '4px',
                                      marginTop: '0.35rem',
                                      fontSize: '0.7rem',
                                      overflowX: 'auto',
                                    }}
                                  >
                                    {JSON.stringify(e.diff, null, 2)}
                                  </pre>
                                </details>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Test Email Modal */}
      {isTestEmailOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              width: '420px',
              maxWidth: '90vw',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Send Test Email
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Verify live delivery capability by dispatching an end-to-end test message.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  marginBottom: '0.35rem',
                }}
              >
                Recipient Email Address
              </label>
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setIsTestEmailOpen(false)}
                style={{
                  padding: '0.45rem 1rem',
                  backgroundColor: '#f1f5f9',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isTestingEmail || !testEmailRecipient}
                style={{
                  padding: '0.45rem 1rem',
                  backgroundColor: 'var(--primary-blue)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                {isTestingEmail ? 'Sending...' : 'Send Test Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
