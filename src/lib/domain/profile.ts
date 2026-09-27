export const STUDENT_STATUSES = ["enrolled", "graduated"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const EDUCATION_LEVELS = [
  "secondary", "associate", "bachelor", "master", "doctorate",
] as const;
export type Education = (typeof EDUCATION_LEVELS)[number];

// Missing/unsupported profile information stays null; it is never a contradiction.
export interface QualificationProfile {
  student_status: StudentStatus | null;
  graduation_year: number | null;
  education: Education | null;
  major: string | null;
  days_per_week?: number | null;
  duration_months?: number | null;
  research_areas?: string[] | null;
}

export interface PreferenceProfile {
  preferred_cities: string[];
  preferred_roles: string[];
  preferred_companies: string[];
}
