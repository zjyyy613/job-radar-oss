import "server-only";
import { cache } from "react";
import { createServerReader } from "./supabase-server";
import { queryRadar } from "./job-read-model";
export const getRadarData = cache(() => queryRadar(createServerReader()));
export async function getJob(id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  return (await getRadarData()).jobs.find((job) => job.id === id) ?? null;
}
