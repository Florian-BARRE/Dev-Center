import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { theme } from '../../theme';
import { createProject } from '../../api/projects';
import { MODEL_OPTIONS } from '../../api/types';
import RepoStep from './steps/RepoStep';
import ModelStep from './steps/ModelStep';
import ConfirmStep from './steps/ConfirmStep';

type Step = 1 | 2 | 3;

const STEP_META: { label: string; title: string }[] = [
  { label: '1', title: 'Repository' },
  { label: '2', title: 'Model' },
  { label: '3', title: 'Confirm' },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
      {STEP_META.map((s, i) => {
        const stepNum = (i + 1) as Step;
        const isDone    = current > stepNum;
        const isActive  = current === stepNum;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Circle */}
            <div style={{
              width: '32px', height: '32px',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDone
                ? theme.colors.success
                : isActive
                ? theme.colors.accent
                : theme.colors.surfaceElevated,
              border: isDone
                ? `1px solid ${theme.colors.success}`
                : isActive
                ? `1px solid ${theme.colors.accent}`
                : `1px solid ${theme.colors.border}`,
              color: isDone || isActive ? theme.colors.onPrimary : theme.colors.muted,
              fontSize: theme.font.size.sm,
              fontFamily: theme.font.mono,
              fontWeight: theme.font.weight.semibold,
              flexShrink: 0,
              boxShadow: 'none',
              transition: theme.transition.base,
            }}>
              {isDone ? '✓' : s.label}
            </div>

            {/* Label below the circle — only for active */}
            <div style={{
              position: 'absolute',
              marginTop: '52px',
              marginLeft: '-20px',
              width: '70px',
              textAlign: 'center',
              fontSize: theme.font.size.xs,
              fontFamily: theme.font.sans,
              color: isActive ? theme.colors.text : theme.colors.muted,
              fontWeight: isActive ? theme.font.weight.semibold : theme.font.weight.normal,
              pointerEvents: 'none',
            }}>
              {s.title}
            </div>

            {/* Connector line */}
            {i < STEP_META.length - 1 && (
              <div style={{
                width: '60px', height: '1px',
                background: isDone ? theme.colors.success : theme.colors.border,
                margin: '0 4px',
                transition: 'background 0.3s ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── NewProjectPage ────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [repoUrl, setRepoUrl] = useState('');
  const [provider, setProvider] = useState(MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(MODEL_OPTIONS[0].model);
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const project = await createProject({ groupId, repoUrl, provider, model });
      navigate(`/projects/${encodeURIComponent(project.groupId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '32px',
      minHeight: '100vh',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '24px',
        fontSize: theme.font.size.xs,
        fontFamily: theme.font.mono,
        color: theme.colors.muted,
      }}>
        <Link to="/" style={{ color: theme.colors.muted, textDecoration: 'none' }}>
          Dashboard
        </Link>
        <span>›</span>
        <span style={{ color: theme.colors.textSecondary }}>New Project</span>
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          paddingBottom: '24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          marginBottom: '32px',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: theme.font.display,
            fontWeight: theme.font.weight.bold,
            fontSize: theme.font.size.xl,
            color: theme.colors.text,
          }}>
            New Project
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: theme.font.size.sm, color: theme.colors.muted }}>
            Connect a Git repository to a Telegram coding agent
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ position: 'relative', marginBottom: '48px' }}>
          <StepIndicator current={step} />
        </div>

        {/* Step card */}
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.xl,
          padding: '24px',
          boxShadow: 'none',
        }}>
          {/* Step label */}
          <div style={{
            fontSize: theme.font.size.xs,
            fontFamily: theme.font.mono,
            color: theme.colors.muted,
            marginBottom: '16px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.08em',
          }}>
            Step {step} of {STEP_META.length} — {STEP_META[step - 1].title}
          </div>

          {step === 1 && (
            <RepoStep
              repoUrl={repoUrl}
              onChange={setRepoUrl}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <ModelStep
              provider={provider}
              model={model}
              onChange={(p, m) => { setProvider(p); setModel(m); }}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <ConfirmStep
              repoUrl={repoUrl}
              provider={provider}
              model={model}
              groupId={groupId}
              onGroupIdChange={setGroupId}
              onBack={() => setStep(2)}
              onConfirm={handleConfirm}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
