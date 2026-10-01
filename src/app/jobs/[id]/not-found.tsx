import Link from "next/link";
export default function NotFound() {
  return (
    <main className="profile-page">
      <h1>没有找到该岗位</h1>
      <p>链接可能已失效，请返回列表查找。</p>
      <Link className="text-link" href="/radar">
        返回 Radar →
      </Link>
    </main>
  );
}
