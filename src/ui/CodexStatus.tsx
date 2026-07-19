import type { CodexDiagnostics } from '../shared/contracts';

interface CodexStatusProps {
  readonly diagnostics: CodexDiagnostics | null;
  readonly checking: boolean;
  readonly preview: boolean;
  readonly onRetry: () => void;
}

export function CodexStatus({
  diagnostics,
  checking,
  preview,
  onRetry,
}: CodexStatusProps) {
  if (preview) {
    return <span className="codex-status codex-status-preview">Interface preview</span>;
  }

  if (checking) {
    return (
      <span className="codex-status" role="status">
        <span className="status-spinner" aria-hidden="true" />
        Checking Codex
      </span>
    );
  }

  if (diagnostics?.authenticated) {
    const authLabel = diagnostics.authMethod === 'chatgpt' ? 'ChatGPT' : 'Ready';
    return (
      <span className="codex-status codex-status-ready" role="status">
        <span className="local-dot" aria-hidden="true" />
        Codex {diagnostics.version ?? ''} · {authLabel}
      </span>
    );
  }

  return (
    <button className="codex-status codex-status-action" type="button" onClick={onRetry}>
      <span className="status-alert" aria-hidden="true">!</span>
      Codex setup needed
    </button>
  );
}
