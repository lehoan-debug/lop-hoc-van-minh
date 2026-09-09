"use client";

import * as React from "react";
import { Loader2, Upload, Download, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface ImportUserError {
  rowIndex: number;
  emailRaw: string;
  reason: string;
}

interface ImportResult {
  totalRows: number;
  importedCount: number;
  errorCount: number;
  createdCount: number;
  updatedCount: number;
  errors: ImportUserError[];
}

export function ImportUsersDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/users/import", { method: "POST", body: formData });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        toast({ variant: "error", title: data.error ?? "Không thể nhập dữ liệu." });
        return;
      }
      setResult(data);
      if (data.importedCount > 0) {
        toast({
          variant: "success",
          title: `Đã nhập ${data.importedCount} tài khoản (${data.createdCount} mới, ${data.updatedCount} cập nhật).`,
        });
      }
      if (data.errorCount > 0) {
        toast({
          variant: data.importedCount > 0 ? "info" : "error",
          title: `${data.errorCount} dòng lỗi, xem chi tiết bên dưới.`,
        });
      }
    } catch {
      toast({ variant: "error", title: "Lỗi kết nối. Vui lòng thử lại." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập tài khoản từ Excel</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          File Excel (.xlsx) 4 cột, từ dòng 2 (dòng 1 là tiêu đề): A = Email, B = Họ tên, C = Vai
          trò, D = Lớp chủ nhiệm (chỉ cần nếu có vai trò GVCN). Tài khoản đã tồn tại sẽ được CỘNG
          THÊM vai trò/lớp chủ nhiệm mới, không xoá gì cả. Chỉ Ất ơ mới cấp được
          vai trò Quản trị viên qua import.
        </p>

        <a
          href="/api/admin/users/import-template"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />
          Tải file mẫu
        </a>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="text-sm"
          />
          <Button size="sm" onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Tải lên &amp; Nhập
          </Button>
        </div>

        {result && (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-muted-foreground">Tổng {result.totalRows} dòng</span>
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-4 w-4" />
                {result.importedCount} thành công ({result.createdCount} mới, {result.updatedCount} cập nhật)
              </span>
              {result.errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="h-4 w-4" />
                  {result.errorCount} lỗi
                </span>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-[var(--radius)] border border-destructive/30">
                <table className="w-full text-xs">
                  <thead className="bg-destructive/5 text-left text-destructive">
                    <tr>
                      <th className="px-2 py-1.5">Dòng</th>
                      <th className="px-2 py-1.5">Email</th>
                      <th className="px-2 py-1.5">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1.5">{e.rowIndex}</td>
                        <td className="px-2 py-1.5">{e.emailRaw || "—"}</td>
                        <td className="px-2 py-1.5">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
