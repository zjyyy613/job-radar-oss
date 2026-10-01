"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProfileForm } from "../../components/profile-form";
import { emptyGuestProfile } from "../../lib/profile/local-profile";
import { localProfile, useLocalProfile } from "../../lib/profile/use-local-profile";

export default function Onboarding() {
  const snapshot = useLocalProfile(), router = useRouter();
  const [saveFailed, setSaveFailed] = useState(false);
  return <main className="profile-page"><header><p className="eyebrow">开始使用</p><h1>先填写基本资格</h1><p>无需登录。资料只保存在当前浏览器，用于核对岗位要求。</p></header>
    {!snapshot.loaded ? <p role="status">正在读取本地资料…</p> : snapshot.error && !saveFailed ? <><p className="error" role="alert">{snapshot.error}</p><Link href="/profile">前往资料页处理本地数据</Link></> : <>
      {snapshot.error && <p className="error" role="alert">{snapshot.error}</p>}
      {snapshot.data && <p className="hint">已有本地资料，可在此更新，或<Link href="/profile">查看资料</Link>。</p>}
      <ProfileForm initial={snapshot.data ?? emptyGuestProfile()} onboarding onSave={value => { if (!localProfile.write(value)) { setSaveFailed(true); return false; } router.push("/radar"); return true; }} />
    </>}
  </main>;
}
