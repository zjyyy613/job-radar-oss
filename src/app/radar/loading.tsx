export default function Loading() {
  return (
    <main className="radar-page loading-state" aria-busy="true">
      <h1>Radar</h1>
      <p role="status">正在读取岗位与来源状态…</p>
      <div className="loading-lines" aria-hidden="true" />
    </main>
  );
}
