/// <reference types="vite/client" />
import type { DockApi } from '../../preload';

declare global {
  // Bridge to main, exposed by the preload script
  const dock: DockApi;
}
