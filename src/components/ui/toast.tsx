"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success shrink-0" />,
  error: <XCircle className="h-5 w-5 text-destructive shrink-0" />,
  info: <Info className="h-5 w-5 text-primary shrink-0" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev, { ...t, id }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* pointer-events-none ở khung ngoài: khung này LUÔN được render (kể
          cả khi rỗng) và fixed top-0 full-width — nếu không tắt pointer-events,
          phần padding của nó vẫn chặn click vào bất kỳ nút nào nằm ở top của
          trang bên dưới (vd. nút "Quay lại" trong header sticky) ngay cả khi
          không có toast nào đang hiện. Mở lại pointer-events-auto ở từng thẻ
          toast thật để vẫn bấm đóng được. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-[var(--radius)] border border-border bg-card p-3 shadow-lg animate-in slide-in-from-top-2"
          >
            {ICONS[t.variant]}
            <div className="flex-1 text-sm">
              <p className="font-medium">{t.title}</p>
              {t.description && (
                <p className="text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải dùng trong ToastProvider");
  return ctx;
}
