import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { theme } from '../theme';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
}

export default function MarkdownEditor({ value, onChange, readOnly, minHeight = '300px' }: MarkdownEditorProps) {
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        minHeight,
      }}
    >
      <CodeMirror
        value={value}
        height={minHeight}
        extensions={[markdown()]}
        onChange={onChange}
        readOnly={readOnly}
        theme="dark"
        basicSetup={{ lineNumbers: true, foldGutter: false }}
        style={{ fontFamily: theme.font.mono, fontSize: theme.font.size.md }}
      />
    </div>
  );
}
