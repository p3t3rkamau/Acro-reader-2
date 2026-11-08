import { useSyncExternalStore } from 'react';
import type { LayoutMode } from '@/types/pdf';
import { getLayoutMode, subscribeLayout } from '@/utils/device';

/** Current layout bucket, updated on resize/rotation. Server snapshot is "desktop". */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribeLayout, getLayoutMode, () => 'desktop');
}
