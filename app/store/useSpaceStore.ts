import { create } from 'zustand';

export type Scene = 'entrance' | 'speaking' | 'trashing' | 'resting' | 'nostalgia' | 'roaming';

interface SpaceState {
  currentScene: Scene;
  setScene: (scene: Scene) => void;
}

export const useSpaceStore = create<SpaceState>((set) => ({
  currentScene: 'entrance',
  setScene: (scene) => set({ currentScene: scene }),
}));