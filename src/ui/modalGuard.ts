/** Tracks open modal dialogs so the message pump can defer accelerators. */
let modalDepth = 0;

export const beginModalDialog = (): void => {
  modalDepth += 1;
};

export const endModalDialog = (): void => {
  modalDepth = Math.max(0, modalDepth - 1);
};

export const isModalDialogOpen = (): boolean => modalDepth > 0;
