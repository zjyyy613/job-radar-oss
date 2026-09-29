"use client";

import { useState, type FormEvent } from "react";
import { EDUCATION_LEVELS } from "../lib/domain/profile";
import { EDUCATION_LABELS, MAJOR_OPTIONS, majorLabel } from "../lib/domain/profile-values";
import { type GuestProfile, validateGuestProfile } from "../lib/profile/local-profile";

type Draft = Record<"student_status" | "graduation_year" | "education" | "major" | "days_per_week" | "duration_months" | "research_areas" | "preferred_cities" | "preferred_roles" | "preferred_companies", string>;
const list = (value: string) => [...new Set(value.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean))];
const number = (value: string) => value.trim() === "" ? null : Number(value);
function toDraft(value: GuestProfile): Draft {
  const q = value.qualification, p = value.preferences;
  return { student_status: q.student_status ?? "", graduation_year: q.graduation_year?.toString() ?? "", education: q.education ?? "",
    major: q.major ? majorLabel(q.major) : "", days_per_week: q.days_per_week?.toString() ?? "", duration_months: q.duration_months?.toString() ?? "",
    research_areas: q.research_areas?.join("，") ?? "", preferred_cities: p.preferred_cities.join("，"), preferred_roles: p.preferred_roles.join("，"), preferred_companies: p.preferred_companies.join("，") };
}
export function ProfileForm({ initial, onboarding = false, onSave, onCancel }: {
  initial: GuestProfile; onboarding?: boolean; onSave: (data: GuestProfile) => boolean; onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [noResearch, setNoResearch] = useState(initial.qualification.research_areas?.length === 0);
  const set = (key: keyof Draft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onboarding && step === 1) { setStep(2); return; }
    try {
      const data = validateGuestProfile({ version: 1, qualification: {
        student_status: draft.student_status || null, graduation_year: number(draft.graduation_year), education: draft.education || null,
        major: draft.major.trim() || null, days_per_week: number(draft.days_per_week), duration_months: number(draft.duration_months),
        research_areas: noResearch ? [] : draft.research_areas.trim() ? list(draft.research_areas) : null,
      }, preferences: { preferred_cities: list(draft.preferred_cities), preferred_roles: list(draft.preferred_roles), preferred_companies: list(draft.preferred_companies) } });
      if ([data.qualification.student_status, data.qualification.graduation_year, data.qualification.education, data.qualification.major].some(value => value === null)) throw new Error();
      setError(null);
      onSave(data);
    } catch { setError("请检查四项必填资料，以及每周天数和实习月数。空白选填项不会被推测补全。"); }
  }
  const input = (name: keyof Draft, label: string, props: { type?: string; required?: boolean; min?: number; max?: number; step?: string; placeholder?: string; list?: string } = {}) => (
    <label className="field" htmlFor={name}>{label}<input id={name} name={name} value={draft[name]} onChange={e => set(name, e.target.value)} maxLength={200} {...props} /></label>
  );
  return <form onSubmit={submit}>
    {onboarding && <p className="step" aria-live="polite">第 {step} 步 / 共 2 步 · {step === 1 ? "基本资格" : "选填信息"}</p>}
    {(!onboarding || step === 1) && <fieldset>
      <legend>基本资格</legend><p className="hint">以下四项必填，用于核对岗位的明确条件。</p>
      <div className="fields">
        <label className="field" htmlFor="student_status">学生状态<select id="student_status" required value={draft.student_status} onChange={e => set("student_status", e.target.value)}><option value="">请选择</option><option value="enrolled">在校</option><option value="graduated">已毕业</option></select></label>
        {input("graduation_year", "毕业年份", { type: "number", required: true, min: 1000, max: 9999, step: "1", placeholder: "例如 2027" })}
        <label className="field" htmlFor="education">学历<select id="education" required value={draft.education} onChange={e => set("education", e.target.value)}><option value="">请选择</option>{EDUCATION_LEVELS.map(level => <option key={level} value={level}>{EDUCATION_LABELS[level]}</option>)}</select></label>
        {input("major", "专业", { required: true, list: "major-options", placeholder: "输入实际所学专业" })}
        <datalist id="major-options">{MAJOR_OPTIONS.map(([key, label]) => <option key={key} value={label} />)}</datalist>
      </div>
    </fieldset>}
    {(!onboarding || step === 2) && <>
      <fieldset><legend>可投入时间 <span>选填</span></legend><p className="hint">暂未确定可以留空。岗位明确要求这些信息时，会提示你确认。</p><div className="fields">
        {input("days_per_week", "每周可到岗天数", { type: "number", min: 0, max: 7, step: "1", placeholder: "0–7 天" })}
        {input("duration_months", "可连续实习月数", { type: "number", min: 0, step: "any", placeholder: "例如 3 或 6" })}
        {!onboarding && <div>{!noResearch && input("research_areas", "研究方向（选填）", { placeholder: "例如 多模态大模型，计算机视觉" })}<label className="checkbox"><input type="checkbox" checked={noResearch} onChange={e => setNoResearch(e.target.checked)} />暂无研究方向</label><p className="hint">未填写表示待确认；勾选表示目前没有研究方向。</p></div>}
      </div></fieldset>
      <fieldset><legend>求职偏好 <span>选填</span></legend><p className="hint">偏好不影响资格判断。多项用逗号分隔。</p><div className="fields">
        {input("preferred_cities", "偏好城市", { placeholder: "例如 北京，上海" })}
        {!onboarding && <>{input("preferred_roles", "偏好岗位", { placeholder: "例如 算法工程师" })}{input("preferred_companies", "偏好公司", { placeholder: "例如 腾讯，小米" })}</>}
      </div></fieldset>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions">
      {onboarding && step === 2 && <button type="button" className="secondary" onClick={() => setStep(1)}>上一步</button>}
      {onCancel && <button type="button" className="secondary" onClick={onCancel}>取消</button>}
      <button type="submit">{onboarding ? step === 1 ? "继续" : "保存到此浏览器" : "保存修改"}</button>
    </div>
  </form>;
}
