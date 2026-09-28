// Audited Spike v2 vocabulary. This is extraction normalization, not a Profile extension.
export const majors: Record<string, RegExp> = {
  stem: /理工科/, business: /商科/, computer_science: /计算机/, it: /信息技术/,
  mechanical: /机械/, ai: /人工智能|\bAI\b/i, ml: /机器学习|\bML\b/i,
  robotics: /机器人/, cv: /计算机视觉|\bCV\b/i, electronics: /电子/,
  optics: /光电/, semiconductor: /半导体/, human_resources: /人力资源/,
  management: /管理/, statistics: /统计/, data: /数据/, finance: /财经|金融/,
};
export const research: Record<string, RegExp> = {
  vlm: /\bVLM\b/i, multimodal: /多模态大模型/, video_understanding: /视频理解/,
  "3d_vision": /3D\s*视觉/i, vln: /\bVLN\b/i, embodied_agent: /Embodied\s+Agent/i,
  rl: /\bRL\b|强化学习/i, video_generation: /视频生成/, world_model: /世界模型|World\s+Model/i,
  image_processing: /图像处理/, cv: /计算机视觉|\bCV\b/i,
  pattern_recognition: /模式识别/, llm: /(?<!多模态)大模型|\bLLM\b/i,
};
export const degrees: Record<string, RegExp> = {
  secondary: /高中|中专/, associate: /大专|专科/, bachelor: /本科|学士/,
  master: /硕士/, doctorate: /博士/,
};
export function tokens(text: string, vocabulary: Record<string, RegExp>): string[] {
  return Object.entries(vocabulary).filter(([, pattern]) => pattern.test(text))
    .sort((a, b) => text.search(a[1]) - text.search(b[1])).map(([token]) => token);
}

export function completeMajorList(text: string): boolean {
  let remainder = text;
  // Longest aliases first, so 计算机视觉 is not reduced to an unknown fragment.
  for (const expression of Object.values(majors).sort((a, b) => b.source.length - a.source.length)) {
    remainder = remainder.replace(new RegExp(expression.source, "gi"), "");
  }
  return remainder.replace(/交叉学科|相关|背景|方向|工程|类|等|或|及|与|和|[\s、/，,]/g, "").length === 0;
}
