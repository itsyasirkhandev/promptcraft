import {
  Code,
  PencilSimple,
  Megaphone,
  ChartBar,
  Palette,
  GraduationCap,
  Globe,
} from '@phosphor-icons/react';

/**
 * The 7 project prompt categories. The ids match `allowedCategories` in
 * `convex/authed/validation.ts` (the source of truth); labels and icons are
 * shared by the dashboard `CategorySelector` and the marketplace search.
 */
export const PROMPT_CATEGORIES = [
  { id: 'coding', label: 'Coding & Tech', icon: Code },
  { id: 'writing', label: 'Writing & Content', icon: PencilSimple },
  { id: 'marketing', label: 'Marketing & Growth', icon: Megaphone },
  { id: 'analysis', label: 'Data & Analysis', icon: ChartBar },
  { id: 'design', label: 'Design & Art', icon: Palette },
  { id: 'education', label: 'Education & Learning', icon: GraduationCap },
  { id: 'other', label: 'General / Other', icon: Globe },
] as const;
