import React, { useState, useEffect, useCallback } from 'react';
import { type TeamMemberAdminDTO, type UserSummaryDTO } from '@newtonite/shared';
import {
  fetchTeamsAdmin,
  fetchTeamMembersAdmin,
  fetchAllUsersAdmin,
  createUserAdmin,
  addTeamMemberAdmin,
  updateMemberRoleAdmin,
  removeMemberAdmin,
  toggleUserActiveAdmin,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from '../components/ui/Badge';
import { CardSkeleton } from '../components/ui/LoadingSkeleton';

interface TeamListPageProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
}

export const TeamListPage: React.FC<TeamListPageProps> = ({ onNotify }) => {
  const { token, currentUser } = useAuth();
  const userRole = currentUser?.memberships[0]?.role || 'ADMIN';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [teams, setTeams] = useState<
    Array<{ id: string; name: string; slug: string; description: string | null }>
  >([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberAdminDTO[]>([]);
  const [allUsers, setAllUsers] = useState<UserSummaryDTO[]>([]);
  const [viewMode, setViewMode] = useState<'memberships' | 'all_users'>('memberships');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  // Add Member / Create User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'create_new' | 'add_existing'>('create_new');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields for "Create New User"
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('Newtonite@2026!');
  const [newUserSystemRole, setNewUserSystemRole] = useState<'USER' | 'SYSTEM_ADMIN'>('USER');
  const [newUserAssignTeam, setNewUserAssignTeam] = useState(true);
  const [newUserTeamId, setNewUserTeamId] = useState('');
  const [newUserTeamRole, setNewUserTeamRole] = useState<'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN'>(
    'MEMBER'
  );

  // Form fields for "Add Existing User to Team"
  const [existingUserId, setExistingUserId] = useState('');
  const [existingTeamId, setExistingTeamId] = useState('');
  const [existingTeamRole, setExistingTeamRole] = useState<'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN'>(
    'MEMBER'
  );

  // Load teams and users
  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [teamsData, membersData, usersData] = await Promise.all([
        fetchTeamsAdmin(token),
        fetchTeamMembersAdmin(token, selectedTeamId || undefined),
        fetchAllUsersAdmin(token),
      ]);
      setTeams(teamsData);
      setTeamMembers(membersData);
      setAllUsers(usersData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load team directory';
      onNotify('error', msg, 'Loading Error');
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedTeamId, onNotify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Create New User
  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    try {
      await createUserAdmin(token, {
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        systemRole: newUserSystemRole,
        teamId: newUserAssignTeam ? newUserTeamId || teams[0]?.id : undefined,
        teamRole: newUserAssignTeam ? newUserTeamRole : undefined,
      });

      onNotify(
        'success',
        `User account created for ${newUserName} (${newUserEmail})`,
        'User Created'
      );
      setIsModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('Newtonite@2026!');
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'User creation failed';
      onNotify('error', msg, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Existing User to Team
  const handleAddExistingUserToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const targetTeam = existingTeamId || selectedTeamId || teams[0]?.id;
    if (!targetTeam || !existingUserId) {
      onNotify('error', 'Please select both a user and a target team', 'Validation Error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTeamMemberAdmin(token, targetTeam, {
        userId: existingUserId,
        role: existingTeamRole,
      });
      onNotify('success', 'User added to team successfully', 'Member Added');
      setIsModalOpen(false);
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member to team';
      onNotify('error', msg, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Team summary counts
  const totalMembers = teamMembers.length;

  if (isLoading && teams.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}
          >
            Team Directory & Access Control
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Inspect operational squads, manage team memberships, role-based access control (RBAC),
            and user accounts.
          </p>
        </div>

        {/* Action Button */}
        {userRole === 'ADMIN' && (
          <button
            type="button"
            onClick={() => {
              setNewUserTeamId(selectedTeamId || teams[0]?.id || '');
              setExistingTeamId(selectedTeamId || teams[0]?.id || '');
              if (allUsers.length > 0 && !existingUserId) {
                setExistingUserId(allUsers[0].id);
              }
              setIsModalOpen(true);
            }}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: 'var(--primary-blue)',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>＋</span>
            <span>Add Member / Create User</span>
          </button>
        )}
      </div>

      {/* Operational Team Cards Grid */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 750,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}
          >
            Operational Teams ({teams.length})
          </div>
          {selectedTeamId && (
            <button
              onClick={() => setSelectedTeamId('')}
              style={{
                fontSize: '0.75rem',
                color: 'var(--primary-blue)',
                fontWeight: 650,
                cursor: 'pointer',
              }}
            >
              Clear Filter (Show All Teams)
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {teams.map((t) => {
            const isSelected = selectedTeamId === t.id;
            const teamMemberCount = teamMembers.filter((m) => m.teamId === t.id).length;
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTeamId(isSelected ? '' : t.id)}
                style={{
                  backgroundColor: '#ffffff',
                  border: isSelected
                    ? '2px solid var(--primary-blue)'
                    : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  cursor: 'pointer',
                  boxShadow: isSelected
                    ? '0 4px 12px rgba(37, 99, 235, 0.12)'
                    : 'var(--shadow-card)',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      backgroundColor: 'var(--primary-blue)',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 750,
                      padding: '0.15rem 0.6rem',
                      borderBottomLeftRadius: '6px',
                    }}
                  >
                    FILTERED
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    marginBottom: '0.4rem',
                  }}
                >
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--primary-blue)' : '#eff6ff',
                      color: isSelected ? '#ffffff' : 'var(--primary-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 750,
                      fontSize: '0.85rem',
                    }}
                  >
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <div
                      style={{ fontWeight: 750, fontSize: '0.95rem', color: 'var(--text-main)' }}
                    >
                      {t.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Slug: <code style={{ fontFamily: 'monospace' }}>{t.slug}</code>
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: '0.775rem',
                    color: 'var(--text-muted)',
                    margin: '0.5rem 0 0.85rem 0',
                    lineHeight: 1.4,
                  }}
                >
                  {t.description || 'Core operations squad handling platform services and tasks.'}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.65rem',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    Personnel:{' '}
                    <strong style={{ color: 'var(--text-main)' }}>{teamMemberCount} members</strong>
                  </span>
                  <span
                    style={{
                      color: isSelected ? 'var(--primary-blue)' : 'var(--text-subtle)',
                      fontWeight: 650,
                    }}
                  >
                    {isSelected ? 'Click to Unfilter' : 'Click to Filter →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Personnel Workspace */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        {/* Navigation Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          {/* View Mode Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setViewMode('memberships')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '1px solid',
                borderColor:
                  viewMode === 'memberships' ? 'var(--primary-blue)' : 'var(--border-color)',
                backgroundColor: viewMode === 'memberships' ? 'var(--primary-blue)' : '#ffffff',
                color: viewMode === 'memberships' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>👥</span>
              <span>Team Memberships ({teamMembers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('all_users')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '1px solid',
                borderColor:
                  viewMode === 'all_users' ? 'var(--primary-blue)' : 'var(--border-color)',
                backgroundColor: viewMode === 'all_users' ? 'var(--primary-blue)' : '#ffffff',
                color: viewMode === 'all_users' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>👤</span>
              <span>All System Accounts ({allUsers.length})</span>
            </button>
          </div>

          {/* Right Toolbar Controls */}
          {viewMode === 'memberships' ? (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label
                style={{
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                Filter by Squad:
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                style={{
                  minWidth: '200px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                }}
              >
                <option value="">All Operational Teams ({totalMembers})</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search accounts by name or email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  minWidth: '260px',
                }}
              />
            </div>
          )}
        </div>

        {/* VIEW 1: Team Memberships Table */}
        {viewMode === 'memberships' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '0.75rem 1.25rem' }}>User Profile</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Team / Squad</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Assigned Role (RBAC)</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Status</th>
                  {userRole === 'ADMIN' && (
                    <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {teamMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={userRole === 'ADMIN' ? 5 : 4}
                      style={{
                        padding: '3rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No team members found for this team filter.
                    </td>
                  </tr>
                ) : (
                  teamMembers.map((m) => (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {/* User Profile */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--primary-blue-light)',
                              color: 'var(--primary-blue)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 750,
                              fontSize: '0.8rem',
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            {m.userName.charAt(0)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 750, color: 'var(--text-main)' }}>
                              {m.userName}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                              {m.userEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Team Name */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            fontWeight: 650,
                            fontSize: '0.75rem',
                          }}
                        >
                          {m.teamName}
                        </span>
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <RoleBadge role={m.role} />
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            backgroundColor: m.userIsActive ? '#dcfce7' : '#fee2e2',
                            color: m.userIsActive ? '#166534' : '#991b1b',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: m.userIsActive ? '#16a34a' : '#dc2626',
                            }}
                          />
                          {m.userIsActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Actions */}
                      {userRole === 'ADMIN' && (
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.5rem',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
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
                                  void loadData();
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
                                    `Account for ${m.userName} ${m.userIsActive ? 'deactivated' : 'activated'}`,
                                    'Status Updated'
                                  );
                                  void loadData();
                                } catch (err: unknown) {
                                  const msg =
                                    err instanceof Error ? err.message : 'Status update failed';
                                  onNotify('error', msg, 'Status Error');
                                }
                              }}
                              style={{
                                padding: '0.25rem 0.55rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#f1f5f9',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
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
                                  !window.confirm(`Remove ${m.userName} from team ${m.teamName}?`)
                                )
                                  return;
                                try {
                                  await removeMemberAdmin(token, m.teamId, m.id);
                                  onNotify(
                                    'success',
                                    `Removed ${m.userName} from team`,
                                    'Member Removed'
                                  );
                                  void loadData();
                                } catch (err: unknown) {
                                  const msg = err instanceof Error ? err.message : 'Removal failed';
                                  onNotify('error', msg, 'Removal Error');
                                }
                              }}
                              style={{
                                padding: '0.25rem 0.55rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: '4px',
                                border: '1px solid #fecaca',
                                cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: All System Accounts Table */}
        {viewMode === 'all_users' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '0.75rem 1.25rem' }}>Account Profile</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>System Access Level</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Assigned Teams & Roles</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Status</th>
                  {userRole === 'ADMIN' && (
                    <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allUsers
                  .filter(
                    (u) =>
                      !userSearchQuery ||
                      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  )
                  .map((u) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {/* Profile */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 750,
                              fontSize: '0.8rem',
                            }}
                          >
                            {u.name.charAt(0)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 750, color: 'var(--text-main)' }}>
                              {u.name}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* System Role */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            backgroundColor:
                              u.systemRole === 'SYSTEM_ADMIN' ? '#eff6ff' : '#f1f5f9',
                            color: u.systemRole === 'SYSTEM_ADMIN' ? '#1d4ed8' : '#475569',
                            border:
                              u.systemRole === 'SYSTEM_ADMIN'
                                ? '1px solid #bfdbfe'
                                : '1px solid #e2e8f0',
                          }}
                        >
                          {u.systemRole}
                        </span>
                      </td>

                      {/* Teams & Roles */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        {u.memberships.length === 0 ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic',
                            }}
                          >
                            No team memberships
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {u.memberships.map((m) => (
                              <span
                                key={m.id}
                                style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.675rem',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  color: '#334155',
                                }}
                              >
                                <strong>{m.teamName}</strong> ({m.role})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Account Status */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            backgroundColor: u.isActive ? '#dcfce7' : '#fee2e2',
                            color: u.isActive ? '#166534' : '#991b1b',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: u.isActive ? '#16a34a' : '#dc2626',
                            }}
                          />
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Actions */}
                      {userRole === 'ADMIN' && (
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.5rem',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setExistingUserId(u.id);
                                setModalTab('add_existing');
                                setIsModalOpen(true);
                              }}
                              style={{
                                padding: '0.25rem 0.55rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 650,
                              }}
                            >
                              + Add to Squad
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                try {
                                  await toggleUserActiveAdmin(token, u.id, !u.isActive);
                                  onNotify(
                                    'success',
                                    `Account ${u.name} ${u.isActive ? 'deactivated' : 'activated'}`,
                                    'Status Updated'
                                  );
                                  void loadData();
                                } catch (err: unknown) {
                                  const msg =
                                    err instanceof Error ? err.message : 'Status update failed';
                                  onNotify('error', msg, 'Status Error');
                                }
                              }}
                              style={{
                                padding: '0.25rem 0.55rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#f1f5f9',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                              }}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Member / Create User */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-popover)',
              width: '100%',
              maxWidth: '520px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Manage Team Personnel</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '1.25rem',
              }}
            >
              <button
                type="button"
                onClick={() => setModalTab('create_new')}
                style={{
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.825rem',
                  fontWeight: modalTab === 'create_new' ? 700 : 500,
                  borderBottom:
                    modalTab === 'create_new'
                      ? '2px solid var(--primary-blue)'
                      : '2px solid transparent',
                  color: modalTab === 'create_new' ? 'var(--primary-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                Create New User
              </button>
              <button
                type="button"
                onClick={() => setModalTab('add_existing')}
                style={{
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.825rem',
                  fontWeight: modalTab === 'add_existing' ? 700 : 500,
                  borderBottom:
                    modalTab === 'add_existing'
                      ? '2px solid var(--primary-blue)'
                      : '2px solid transparent',
                  color: modalTab === 'add_existing' ? 'var(--primary-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                Add Existing User to Team
              </button>
            </div>

            {/* Tab 1: Create New User */}
            {modalTab === 'create_new' && (
              <form
                onSubmit={handleCreateNewUser}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
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
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                    placeholder="e.g. John Doe"
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
                    Work Email *
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    placeholder="john.doe@company.dev"
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
                    Temporary Initial Password *
                  </label>
                  <input
                    type="text"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                    Minimum 6 characters. User can sign in immediately with this credential.
                  </span>
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
                    System Role
                  </label>
                  <select
                    value={newUserSystemRole}
                    onChange={(e) =>
                      setNewUserSystemRole(e.target.value as 'USER' | 'SYSTEM_ADMIN')
                    }
                    style={{ width: '100%' }}
                  >
                    <option value="USER">USER — Standard User (Team-level permissions)</option>
                    <option value="SYSTEM_ADMIN">
                      SYSTEM_ADMIN — Full Administrator (Global Settings access)
                    </option>
                  </select>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginBottom: newUserAssignTeam ? '0.75rem' : 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newUserAssignTeam}
                      onChange={(e) => setNewUserAssignTeam(e.target.checked)}
                    />
                    Assign to an Operational Squad immediately
                  </label>

                  {newUserAssignTeam && (
                    <div
                      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
                    >
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            marginBottom: '0.25rem',
                          }}
                        >
                          Select Squad
                        </label>
                        <select
                          value={newUserTeamId}
                          onChange={(e) => setNewUserTeamId(e.target.value)}
                          style={{ width: '100%', fontSize: '0.775rem' }}
                        >
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            marginBottom: '0.25rem',
                          }}
                        >
                          Team Role
                        </label>
                        <select
                          value={newUserTeamRole}
                          onChange={(e) =>
                            setNewUserTeamRole(
                              e.target.value as 'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN'
                            )
                          }
                          style={{ width: '100%', fontSize: '0.775rem' }}
                        >
                          <option value="VIEWER">VIEWER (Read-only)</option>
                          <option value="MEMBER">MEMBER (Standard operator)</option>
                          <option value="LEAD">LEAD (Team leader / Escalations)</option>
                          <option value="ADMIN">ADMIN (Team manager)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      padding: '0.45rem 1rem',
                      backgroundColor: '#f1f5f9',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '0.45rem 1.25rem',
                      backgroundColor: 'var(--primary-blue)',
                      color: '#ffffff',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Add Existing User to Team */}
            {modalTab === 'add_existing' && (
              <form
                onSubmit={handleAddExistingUserToTeam}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
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
                    Select User *
                  </label>
                  <select
                    value={existingUserId}
                    onChange={(e) => setExistingUserId(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Choose a registered user --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) {!u.isActive ? '[Deactivated]' : ''}
                      </option>
                    ))}
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
                    Select Target Squad *
                  </label>
                  <select
                    value={existingTeamId || selectedTeamId || teams[0]?.id || ''}
                    onChange={(e) => setExistingTeamId(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
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
                    Assign Squad Role *
                  </label>
                  <select
                    value={existingTeamRole}
                    onChange={(e) =>
                      setExistingTeamRole(e.target.value as 'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN')
                    }
                    style={{ width: '100%' }}
                  >
                    <option value="VIEWER">VIEWER (Read-only)</option>
                    <option value="MEMBER">MEMBER (Standard operator)</option>
                    <option value="LEAD">LEAD (Team leader / Escalations)</option>
                    <option value="ADMIN">ADMIN (Team manager)</option>
                  </select>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      padding: '0.45rem 1rem',
                      backgroundColor: '#f1f5f9',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !existingUserId}
                    style={{
                      padding: '0.45rem 1.25rem',
                      backgroundColor: 'var(--primary-blue)',
                      color: '#ffffff',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Member to Squad'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
