import { create } from "zustand";
// TODO: delete this file
type ExampleState = { 
  ready: boolean; 
  setReady: (v: boolean) => void 
};

export const useExampleStore = create<ExampleState>((set) => ({ 
  ready: false, 
  setReady: (v) => set({ ready: v }) 
}));
