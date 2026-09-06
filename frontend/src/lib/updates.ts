import type { UpdateType } from '../types';

export const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  RELEASE: 'Release',
  ANNOUNCEMENT: 'Announcement',
  FEATURE: 'Feature',
  IMPROVEMENT: 'Improvement',
  FIX: 'Fix',
  MAINTENANCE: 'Maintenance',
};

export function updateTypeLabel(type: string): string {
  return UPDATE_TYPE_LABELS[type as UpdateType] ?? type;
}