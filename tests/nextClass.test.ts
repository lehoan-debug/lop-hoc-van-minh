import { describe, it, expect } from "vitest";
import { findNextUnscoredClass } from "@/lib/rounds/nextClass";

describe("findNextUnscoredClass", () => {
  it("trả về lớp chưa chấm ngay kế tiếp trong danh sách", () => {
    const sorted = ["10A1", "10A2", "10A3", "10A4"];
    const result = findNextUnscoredClass(sorted, "10A1", ["10A1"]);
    expect(result).toBe("10A2");
  });

  it("bỏ qua lớp đã chấm ở giữa, tìm tới lớp chưa chấm xa hơn", () => {
    const sorted = ["10A1", "10A2", "10A3", "10A4"];
    const result = findNextUnscoredClass(sorted, "10A1", ["10A1", "10A2", "10A3"]);
    expect(result).toBe("10A4");
  });

  it("hết danh sách phía sau -> vòng lại từ đầu tìm lớp chưa chấm", () => {
    const sorted = ["10A1", "10A2", "10A3", "10A4"];
    // Đang chấm 10A3, 10A4 đã chấm rồi, 10A1 chưa chấm -> vòng lại lấy 10A1
    const result = findNextUnscoredClass(sorted, "10A3", ["10A2", "10A3", "10A4"]);
    expect(result).toBe("10A1");
  });

  it("đã chấm hết mọi lớp khác -> trả về null", () => {
    const sorted = ["10A1", "10A2", "10A3"];
    const result = findNextUnscoredClass(sorted, "10A1", ["10A1", "10A2", "10A3"]);
    expect(result).toBeNull();
  });

  it("chỉ có 1 lớp duy nhất (chính lớp hiện tại) -> null", () => {
    const result = findNextUnscoredClass(["10A1"], "10A1", ["10A1"]);
    expect(result).toBeNull();
  });

  it("danh sách rỗng -> null, không lỗi", () => {
    expect(findNextUnscoredClass([], "10A1", [])).toBeNull();
  });

  it("lớp hiện tại không có trong danh sách (ngoài phạm vi) -> vẫn tìm được lớp chưa chấm đầu tiên", () => {
    const sorted = ["10A1", "10A2"];
    const result = findNextUnscoredClass(sorted, "10A9", ["10A1"]);
    expect(result).toBe("10A2");
  });
});
