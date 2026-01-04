import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

interface State {
  toasts: ToasterToast[];
}

let memoryState: State = { toasts: [] };
const listeners = new Set<(state: State) => void>();
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function notify() {
  listeners.forEach((l) => l(memoryState));
}

function scheduleRemoval(id: string) {
  if (timeouts.has(id)) return;

  const timeout = setTimeout(() => {
    timeouts.delete(id);
    dispatch({ type: "REMOVE_TOAST", toastId: id });
  }, TOAST_REMOVE_DELAY);

  timeouts.set(id, timeout);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map(t =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.map(t =>
          !action.toastId || t.id === action.toastId
            ? { ...t, open: false }
            : t
        ),
      };

    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: action.toastId
          ? state.toasts.filter(t => t.id !== action.toastId)
          : [],
      };
  }
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  notify();
}

function toast(props: Omit<ToasterToast, "id">) {
  const id = crypto.randomUUID();

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss(id);
      },
    },
  });

  return {
    id,
    dismiss: () => dismiss(id),
    update: (toast: Partial<ToasterToast>) =>
      dispatch({ type: "UPDATE_TOAST", toast: { ...toast, id } }),
  };
}

function dismiss(toastId?: string) {
  if (toastId) scheduleRemoval(toastId);
  dispatch({ type: "DISMISS_TOAST", toastId });
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss,
  };
}

export { toast };
