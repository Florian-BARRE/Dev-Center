import { useRef } from 'react';
import { theme } from '../theme';

interface CodingRulesEditorProps {
  value: string;
  onChange: (content: string) => void;
}

export default function CodingRulesEditor({ value, onChange }: CodingRulesEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sort files alphabetically, read with FileReader, concat with separators
  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length === 0) return;
    const readers = files.map(
      (f) =>
        new Promise<{ name: string; content: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: f.name, content: reader.result as string });
          reader.onerror = reject;
          reader.readAsText(f);
        })
    );
    Promise.all(readers).then((results) => {
      const concatenated = results.map((r) => `# ${r.name}\n\n${r.content}`).join('\n\n---\n\n');
      onChange(concatenated);
    });
    // Reset so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '4px 10px',
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.sans,
          }}
        >
          Upload .md files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.txt"
          onChange={handleFilesUpload}
          style={{ display: 'none' }}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        style={{
          width: '100%',
          background: theme.colors.bg,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.text,
          fontFamily: theme.font.mono,
          fontSize: theme.fontSize.sm,
          padding: '10px 12px',
          resize: 'vertical',
          boxSizing: 'border-box',
          outline: 'none',
          lineHeight: 1.6,
        }}
      />
      <div style={{ marginTop: '6px', fontSize: theme.fontSize.xs, color: theme.colors.muted, textAlign: 'right', fontFamily: theme.font.mono }}>
        {value.length} chars · ~{Math.round(value.length / 4)} tokens
      </div>
    </div>
  );
}
