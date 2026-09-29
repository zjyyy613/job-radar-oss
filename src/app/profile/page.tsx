"use client";

import Link from "next/link";
import { useState } from "react";
import { ProfileForm } from "../../components/profile-form";
import { EDUCATION_LABELS, majorLabel, RESEARCH_OPTIONS } from "../../lib/domain/profile-values";
import { localProfile, useLocalProfile } from "../../lib/profile/use-local-profile";

export default function ProfilePage() {
  const snapshot = useLocalProfile();
  const [editing, setEditing] = useState(false), [confirmClear, setConfirmClear] = useState(false), [message, setMessage] = useState("");
  const data = snapshot.data;
  const row = (label: string, value: string | number | null | undefined) => <div className="profile-row" key={label}><dt>{label}</dt><dd>{value ?? "未填写"}</dd></div>;
  return <main className="profile-page"><header><p className="eyebrow">本地资料</p><h1>{editing && data ? "修改我的资料" : "我的资料"}</h1><p>仅保存在当前浏览器。修改后，资格判断会在本地立即更新。</p></header>
    {message && <p role="status" className="notice">{message}</p>}
    {snapshot.error && <p role="alert" className="error">{snapshot.error}</p>}
    {!snapshot.loaded ? <p role="status">正在读取本地资料…</p> : !data ? <section><h2>还没有本地资料</h2><p>填写学生状态、毕业年份、学历和专业，即可建立资格资料。</p>{!snapshot.error && <Link className="button" href="/onboarding">填写基本资格</Link>}</section> : editing ?
      <ProfileForm initial={data} onCancel={() => setEditing(false)} onSave={value => { if (!localProfile.write(value)) return false; setEditing(false); setMessage("修改已保存在此浏览器。"); return true; }} /> : <>
        <section><div className="section-heading"><h2>资格资料</h2><button className="secondary" onClick={() => { setEditing(true); setMessage(""); }}>修改资料</button></div><dl>
          {row("学生状态", data.qualification.student_status === "enrolled" ? "在校" : data.qualification.student_status === "graduated" ? "已毕业" : null)}
          {row("毕业年份", data.qualification.graduation_year)}
          {row("学历", data.qualification.education ? EDUCATION_LABELS[data.qualification.education] : null)}
          {row("专业", data.qualification.major ? majorLabel(data.qualification.major) : null)}
          {row("每周可到岗天数", data.qualification.days_per_week == null ? null : `${data.qualification.days_per_week} 天`)}
          {row("可连续实习月数", data.qualification.duration_months == null ? null : `${data.qualification.duration_months} 个月`)}
          {row("研究方向", data.qualification.research_areas == null ? null : data.qualification.research_areas.map(value => RESEARCH_OPTIONS.find(([key]) => key === value)?.[1] ?? value).join("、") || "暂无")}
        </dl></section>
        <section><h2>求职偏好</h2><p className="hint">这些偏好不影响资格判断。</p><dl>
          {row("偏好城市", data.preferences.preferred_cities.join("、") || null)}{row("偏好岗位", data.preferences.preferred_roles.join("、") || null)}{row("偏好公司", data.preferences.preferred_companies.join("、") || null)}
        </dl></section>
      </>}
    {snapshot.loaded && <section className="local-data"><h2>管理本地数据</h2><p>清除本浏览器中的 Job Radar 资料与偏好。此操作不会删除其他网站的数据。</p>
      {!confirmClear ? <button className="secondary" onClick={() => setConfirmClear(true)}>清除本地 Job Radar 数据</button> : <div role="group" aria-label="确认清除"><p>清除后需要重新填写，确定继续吗？</p><div className="actions"><button className="secondary" onClick={() => setConfirmClear(false)}>取消清除</button><button onClick={() => { if (localProfile.clear()) { setConfirmClear(false); setEditing(false); setMessage("已清除本地 Job Radar 数据。"); } }}>确认清除</button></div></div>}
    </section>}
  </main>;
}
