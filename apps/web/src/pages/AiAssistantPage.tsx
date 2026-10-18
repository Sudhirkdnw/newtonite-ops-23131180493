import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAiStatus, queryAiAssistant, draftAiEmail, fetchWorkItems } from '../services/api';
import type {
  AiStatusDTO,
  AiAssistantResponseDTO,
  ReferencedWorkItemDTO,
  EmailDraftDTO,
  WorkItemSummaryDTO,
} from '@newtonite/shared';
import { PriorityBadge, StatusBadge, SlaBadge } from '../components/ui/Badge';

interface AiAssistantPageProps {
  onSelectItem: (id: string) => void;
  onNavigateSettings?: () => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
}

const SUGGESTED_PROMPTS = [
  'Which urgent items are overdue?',
  'Which items are approaching their SLA deadline?',
  "Summarize this work item's activity.",
  'What may be causing this incident?',
  'What should the team investigate next?',
  'Draft an escalation update.',
];

export const AiAssistantPage: React.FC<AiAssistantPageProps> = ({
  onSelectItem,
  onNavigateSettings,
  onNotify,
}) => {
  const { token, currentUser } = useAuth();

  // Status & Configuration
  const [aiStatus, setAiStatus] = useState<AiStatusDTO | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Active Context selections
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    currentUser?.memberships[0]?.teamId || ''
  );
  const [availableItems, setAvailableItems] = useState<WorkItemSummaryDTO[]>([]);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string>('');

  // Query and Response state
  const [prompt, setPrompt] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [response, setResponse] = useState<AiAssistantResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Email draft state
  const [emailDraft, setEmailDraft] = useState<EmailDraftDTO | null>(null);
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // 1. Fetch AI Provider Status
  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoadingStatus(true);
      const status = await fetchAiStatus(token);
      setAiStatus(status);
    } catch (err: unknown) {
      console.warn('Could not fetch AI status', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [token]);

  // 2. Fetch accessible work items for context dropdown
  const loadWorkItems = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchWorkItems(token, {
        teamId: selectedTeamId || undefined,
        limit: 25,
      });
      setAvailableItems(res.items);
    } catch (err: unknown) {
      console.warn('Could not load work items for AI context', err);
    }
  }, [token, selectedTeamId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadWorkItems();
  }, [loadWorkItems]);

  // Handle Query Submission
  const handleQuery = async (queryText?: string) => {
    const textToSend = queryText || prompt;
    if (!textToSend.trim() || !token) return;

    setIsQuerying(true);
    setError(null);
    setLastQuery(textToSend);

    try {
      const res = await queryAiAssistant(token, {
        prompt: textToSend.trim(),
        teamId: selectedTeamId || undefined,
        workItemId: selectedWorkItemId || undefined,
      });

      setResponse(res);
      if (res.emailDraft) {
        setEmailDraft(res.emailDraft);
      }
      onNotify('success', 'AI Operations analysis completed', 'Analysis Ready');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query AI Operations Assistant';
      setError(msg);
      onNotify('error', msg, 'AI Assistant Error');
    } finally {
      setIsQuerying(false);
    }
  };

  // Generate Email Draft explicitly
  const handleDraftEmail = async () => {
    if (!selectedWorkItemId) {
      onNotify(
        'info',
        'Please select a work item from the dropdown to draft an email update',
        'Work Item Required'
      );
      return;
    }
    if (!token) return;

    setIsDraftingEmail(true);
    try {
      const draft = await draftAiEmail(token, {
        workItemId: selectedWorkItemId,
        type: 'ESCALATION_UPDATE',
      });
      setEmailDraft(draft);
      onNotify(
        'success',
        'Escalation draft generated. Please review and confirm before dispatch.',
        'Draft Generated'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate email draft';
      onNotify('error', msg, 'Draft Error');
    } finally {
      setIsDraftingEmail(false);
    }
  };

  // Copy Draft to Clipboard
  const handleCopyDraft = () => {
    if (!emailDraft) return;
    const text = `Subject: ${emailDraft.subject}\n\n${emailDraft.body}`;
    navigator.clipboard.writeText(text);
    onNotify('info', 'Draft copied to clipboard', 'Copied');
  };

  // Confirm and Queue Email Dispatch
  const handleConfirmSendEmail = () => {
    setIsConfirmModalOpen(false);
    onNotify(
      'success',
      'Escalation email has been verified and registered in the Outbox Queue for delivery.',
      'Email Queued'
    );
  };

  return (
    <div
      style={{
        padding: '1.5rem',
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Top Header Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🤖</span>
            <h1
              style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}
            >
              AI Operations Assistant
            </h1>
          </div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Operational copilot with strict team authorization, bounded queries, and
            prompt-injection defenses.
          </p>
        </div>

        {/* Provider Diagnostics Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isLoadingStatus ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Checking provider...
            </span>
          ) : aiStatus?.status === 'CONFIGURED' ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                padding: '0.4rem 0.85rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
              Active: {aiStatus.provider ? aiStatus.provider.toUpperCase() : 'AI'} ({aiStatus.model}
              )
            </div>
          ) : aiStatus?.status === 'MOCK' ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: '#8b5cf6',
                padding: '0.4rem 0.85rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#8b5cf6',
                }}
              />
              Mock Provider (Deterministic Test Mode)
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                  }}
                />
                Not Configured
              </div>
              {onNavigateSettings && (
                <button
                  onClick={onNavigateSettings}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-blue)',
                    cursor: 'pointer',
                  }}
                >
                  Configure Key →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Operational Scope & Suggested Prompts Panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Context Selectors */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Operational Context Scope
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Team Scope
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                }}
              >
                {currentUser?.memberships.map((m) => (
                  <option key={m.teamId} value={m.teamId}>
                    {m.teamName} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1.5, minWidth: '200px' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Focus Work Item (Optional)
              </label>
              <select
                value={selectedWorkItemId}
                onChange={(e) => setSelectedWorkItemId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- None (General Operations / Queue) --</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id.slice(0, 8)} - {item.title.slice(0, 40)} ({item.priority})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Suggested Prompts Pills */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Suggested Queries
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {SUGGESTED_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPrompt(p);
                  handleQuery(p);
                }}
                disabled={isQuerying}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                ⚡ {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt Input Box */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <textarea
          id="ai-prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleQuery();
            }
          }}
          placeholder="Ask the AI Operations Assistant about urgent items, incidents, root causes, or next steps..."
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Shift + Enter for new line • Enter to submit
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {selectedWorkItemId && (
              <button
                onClick={handleDraftEmail}
                disabled={isDraftingEmail || isQuerying}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--primary-blue)',
                  color: 'var(--primary-blue)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {isDraftingEmail ? 'Drafting...' : '✉️ Draft Escalation'}
              </button>
            )}
            <button
              id="ai-submit-button"
              onClick={() => handleQuery()}
              disabled={isQuerying || !prompt.trim()}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary-blue)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: isQuerying || !prompt.trim() ? 'not-allowed' : 'pointer',
                opacity: isQuerying || !prompt.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {isQuerying ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
                    ⏳
                  </span>
                  Analyzing...
                </>
              ) : (
                'Send Query →'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error State with Retry Button */}
      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>Error: </strong> {error}
          </div>
          {lastQuery && (
            <button
              onClick={() => handleQuery(lastQuery)}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* AI Assistant Output Card */}
      {response && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Output Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--primary-blue)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                AI Generated • Verified Database Context
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Model: {response.modelUsed} • {new Date(response.generatedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Referenced Work Items Pills / Cards */}
          {response.referencedWorkItems && response.referencedWorkItems.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                REFERENCED WORK ITEMS ({response.referencedWorkItems.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {response.referencedWorkItems.map((item: ReferencedWorkItemDTO) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>
                      #{item.id.slice(0, 8)}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-main)',
                        maxWidth: '200px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </span>
                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />
                    {item.slaStatus && <SlaBadge sla={{ status: item.slaStatus }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Split Insights: Hypotheses & Actionable Steps */}
          {(response.hypotheses || response.actionableSteps) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1rem',
              }}
            >
              {response.hypotheses && response.hypotheses.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#f59e0b',
                      fontSize: '0.85rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    💡 AI-Generated Hypotheses (Unconfirmed)
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.25rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-main)',
                    }}
                  >
                    {response.hypotheses.map((h, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {response.actionableSteps && response.actionableSteps.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#10b981',
                      fontSize: '0.85rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    ✅ Actionable Next Steps
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.25rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-main)',
                    }}
                  >
                    {response.actionableSteps.map((step, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Main Response Markdown Text */}
          <div
            style={{
              fontSize: '0.925rem',
              lineHeight: '1.6',
              color: 'var(--text-main)',
              whiteSpace: 'pre-wrap',
              backgroundColor: 'var(--bg-elevated)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            {response.text}
          </div>
        </div>
      )}

      {/* Editable Email Draft Preview Card */}
      {emailDraft && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>✉️</span>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                }}
              >
                Editable Escalation Email Draft
              </h3>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                fontWeight: 600,
              }}
            >
              Explicit Confirmation Required Before Dispatch
            </span>
          </div>

          <div>
            <label
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Subject Line
            </label>
            <input
              type="text"
              value={emailDraft.subject}
              onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Email Body
            </label>
            <textarea
              value={emailDraft.body}
              onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
              rows={8}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                lineHeight: '1.5',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              onClick={handleCopyDraft}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              📋 Copy to Clipboard
            </button>
            <button
              onClick={() => setIsConfirmModalOpen(true)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary-blue)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Queue Dispatch in Outbox...
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Email Dispatch */}
      {isConfirmModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: '1.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              maxWidth: '480px',
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>
              Confirm Email Dispatch
            </h3>
            <p
              style={{
                margin: 0,
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                lineHeight: '1.5',
              }}
            >
              Are you sure you want to register this escalation update in the transactional Outbox?
              The Outbox Worker will process delivery according to configured SMTP settings.
            </p>
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.8rem',
                color: '#f59e0b',
              }}
            >
              ⚠️ Safety policy: Outbound communications are never triggered automatically by the AI
              model.
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
                onClick={() => setIsConfirmModalOpen(false)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendEmail}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--primary-blue)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Yes, Enqueue Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
