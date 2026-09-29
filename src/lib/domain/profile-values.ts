// Exact aliases only. Unknown text is never guessed into a qualification category.
export const MAJOR_OPTIONS = [
  ["computer_science", "计算机", "stem"], ["it", "信息技术", "stem"], ["ai", "人工智能", "stem"],
  ["ml", "机器学习", "stem"], ["robotics", "机器人", "stem"], ["cv", "计算机视觉", "stem"],
  ["mechanical", "机械", "stem"], ["electronics", "电子", "stem"], ["optics", "光电", "stem"],
  ["semiconductor", "半导体", "stem"], ["human_resources", "人力资源", "business"],
  ["management", "管理", "business"], ["statistics", "统计", "stem"], ["data", "数据", "stem"],
  ["finance", "财经", "business"], ["stem", "理工科", "stem"], ["business", "商科", "business"],
] as const;
export const RESEARCH_OPTIONS = [
  ["vlm", "VLM"], ["multimodal", "多模态大模型"], ["video_understanding", "视频理解"],
  ["3d_vision", "3D视觉"], ["vln", "VLN"], ["embodied_agent", "Embodied Agent"],
  ["rl", "强化学习"], ["video_generation", "视频生成"], ["world_model", "世界模型"],
  ["image_processing", "图像处理"], ["cv", "计算机视觉"], ["pattern_recognition", "模式识别"], ["llm", "大模型"],
] as const;
export const EDUCATION_LABELS = { secondary: "高中 / 中专", associate: "大专", bachelor: "本科", master: "硕士", doctorate: "博士" };
const normalized = (value: string) => value.normalize("NFKC").trim().toLowerCase();
export function normalizeMajor(value: string): string {
  const text = normalized(value);
  const aliases: Record<string, string> = { "机械工程": "mechanical", "计算机科学": "computer_science", "计算机科学与技术": "computer_science", "人力资源管理": "human_resources", "金融": "finance" };
  return MAJOR_OPTIONS.find(([key, label]) => text === normalized(key) || text === normalized(label))?.[0]
    ?? (Object.hasOwn(aliases, text) ? aliases[text] : text);
}
export function normalizeResearch(value: string): string {
  const text = normalized(value);
  return RESEARCH_OPTIONS.find(([key, label]) => text === normalized(key) || text === normalized(label))?.[0] ?? text;
}
export function majorLabel(value: string): string { return MAJOR_OPTIONS.find(([key]) => key === value)?.[1] ?? value; }
