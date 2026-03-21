import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { theme } from '../../theme';
import { createProject } from '../../api/projects';
import { MODEL_OPTIONS } from '../../api/types';
import RepoStep from './steps/RepoStep';
import ModelStep from './steps/ModelStep';
import ConfirmStep from './steps/ConfirmStep';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Step 1 — Repository',
  2: 'Step 2 — Model',
  3: 'Step 3 — Confirm',
};

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
    <div style={{ minHeight: '100vh', background: theme.colors.bg, color: theme.colors.text, fontFamily: theme.font.sans, padding: theme.spacing.xl }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ marginBottom: theme.spacing.lg }}>
          <Link to="/" style={{ color: theme.colors.muted, textDecoration: 'none', fontSize: theme.font.size.sm }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ marginTop: theme.spacing.md, fontSize: theme.font.size.xl, fontFamily: theme.font.mono }}>
            New Project
          </h1>
          <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>
            {STEP_LABELS[step]}
          </div>
        </div>

        <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
          {step === 1 && (
            <RepoStep repoUrl={repoUrl} onChange={setRepoUrl} onNext={() => setStep(2)} />
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
