"use client";
import { Button } from "@/components/ui/button";
export default function RadarError({ reset }: { reset: () => void }) {
  return (
    <main className="radar-page">
      <h1>岗位暂时无法加载</h1>
      <p role="alert">读取服务暂不可用。你的本地资料仍然保留，请稍后重试。</p>
      <Button onClick={reset}>重新加载</Button>
    </main>
  );
}
