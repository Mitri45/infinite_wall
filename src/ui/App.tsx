import { APP_NAME } from '../shared/app-info';

export function App() {
  return (
    <main className="shell">
      <section className="intro" aria-labelledby="app-title">
        <p className="eyebrow">Desktop wallpaper, without the repetition</p>
        <h1 id="app-title">{APP_NAME}</h1>
        <p className="lede">
          A private, Codex-powered wallpaper studio is taking shape here.
        </p>
        <div className="status" role="status">
          <span className="status-dot" aria-hidden="true" />
          Foundation ready on {window.infiniteWall.platform}
        </div>
      </section>
    </main>
  );
}
