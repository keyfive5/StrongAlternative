// Navigation: five tabs plus a stack of pushed screens, and the workout in
// progress as its own full-screen layer that can be minimised to a bar.

import { createContext, useContext } from 'react';
import type { MeasureKind } from '../core/types.ts';

export type Tab = 'today' | 'history' | 'train' | 'exercises' | 'progress';

export type Route =
  | { name: 'exercise'; id: string }
  | { name: 'workout'; id: string }
  | { name: 'editWorkout'; id: string }
  | { name: 'routine'; id?: string; fromWorkout?: string }
  | { name: 'settings'; autoImport?: boolean }
  | { name: 'measure'; kind: MeasureKind }
  | { name: 'summary'; id: string }
  | { name: 'plates' };

export interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  push: (r: Route) => void;
  pop: () => void;
  openWorkout: () => void;
  closeWorkout: () => void;
}

export const NavContext = createContext<Nav>({
  tab: 'today',
  setTab: () => {},
  push: () => {},
  pop: () => {},
  openWorkout: () => {},
  closeWorkout: () => {},
});

export function useNav(): Nav {
  return useContext(NavContext);
}
