import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth/session";

export class DuplicateScoreError extends Error {
  constructor(message = "Kết quả lớp này đã được ghi nhận trong buổi này.") {
    super(message);
    this.name = "DuplicateScoreError";
  }
}

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

/** Chuẩn hoá lỗi thành response JSON tiếng Việt, không lộ raw stack trace. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ.", issues: err.issues },
      { status: 400 },
    );
  }
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof DuplicateScoreError) {
    return NextResponse.json(
      { error: err.message, code: "DUPLICATE_SCORE" },
      { status: 409 },
    );
  }
  if (err instanceof BusinessError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error("[API ERROR]", err);
  return NextResponse.json(
    { error: "Đã có lỗi xảy ra. Vui lòng thử lại." },
    { status: 500 },
  );
}
