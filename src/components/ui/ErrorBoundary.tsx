'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from '../pdf-viewer/Dialog.module.scss';

interface Props { children: ReactNode; onReset: () => void }
interface State { failed: boolean }

/** Last line of defence: a rendering bug shows a message and a way out instead of a white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error('Reader crashed:', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={styles.backdrop}>
        <div className={styles.dialog} role="alert">
          <h2>Something went wrong</h2>
          <p>The reader hit an unexpected problem. Your file was not changed.</p>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={() => { this.setState({ failed: false }); this.props.onReset(); }}>Close document</button>
          </div>
        </div>
      </div>
    );
  }
}
