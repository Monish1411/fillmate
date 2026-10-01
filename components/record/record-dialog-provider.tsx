"use client";

import * as React from "react";

interface RecordDialogValue {
  open: (fullScreen?: boolean) => void;
  close: () => void;
  isOpen: boolean;
  fullScreen: boolean;
}

const RecordDialogContext = React.createContext<RecordDialogValue | null>(null);

export function RecordRefillDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [fullScreen, setFullScreen] = React.useState(false);

  const value = React.useMemo<RecordDialogValue>(
    () => ({
      isOpen,
      fullScreen,
      open: (mobile = false) => {
        setFullScreen(mobile);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [isOpen, fullScreen],
  );

  return (
    <RecordDialogContext.Provider value={value}>{children}</RecordDialogContext.Provider>
  );
}

export function useRecordRefillDialog(): RecordDialogValue {
  const ctx = React.useContext(RecordDialogContext);
  if (!ctx) {
    return { open: () => undefined, close: () => undefined, isOpen: false, fullScreen: false };
  }
  return ctx;
}