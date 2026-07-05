import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed/i;
const CHUNK_RETRY_KEY = 'audax-chunk-retry:boundary';

// Route-level error boundary: a crash in one page renders a recovery card
// instead of black-screening the whole app. `resetKey` (the route path) makes
// the boundary auto-reset when the user navigates to another page.
//
// Special case: a stale chunk (tab left open across a new deploy — the JS
// file it wants no longer exists on the server) isn't a real bug, so it gets
// ONE automatic hard reload instead of the crash card. A sessionStorage guard
// stops a reload loop if the failure turns out to be a genuine outage.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reloading: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    if (CHUNK_ERROR_RE.test(error?.message || '') && !sessionStorage.getItem(CHUNK_RETRY_KEY)) {
      sessionStorage.setItem(CHUNK_RETRY_KEY, '1');
      this.setState({ reloading: true });
      window.location.reload();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, reloading: false });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.reloading) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" style={{ borderTopColor: 'var(--accent-primary)' }} />
            <span className="text-sm text-mute">Updating to the latest version…</span>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-card border border-line rounded-xl p-8 max-w-lg w-full text-center">
          <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: 'var(--warning)' }} />
          <h2 className="text-lg font-semibold mb-2">Something went wrong on this page</h2>
          <p className="text-sm text-mute mb-1">Your data is safe — it lives in local storage and the cloud.</p>
          <p className="text-xs text-mute mb-6 font-mono break-all">{String(this.state.error?.message || this.state.error)}</p>
          <div className="flex justify-center gap-3">
            <button
              className="px-4 py-2 rounded-lg text-sm bg-accent text-black hover:opacity-90 font-semibold cursor-pointer"
              onClick={() => this.setState({ error: null })}
            >
              <span className="flex items-center gap-2"><RefreshCw size={14} /> Try again</span>
            </button>
            <button
              className="px-4 py-2 rounded-lg text-sm bg-surface border border-line text-ink hover:border-accent cursor-pointer"
              onClick={() => { window.location.href = '/'; }}
            >
              <span className="flex items-center gap-2"><Home size={14} /> Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
