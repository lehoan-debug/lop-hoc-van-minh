import { describe, it, expect } from "vitest";
import { distributeClassesSequentially } from "@/lib/rounds/sequentialAssign";

describe("distributeClassesSequentially — chế độ Chia đều (auto)", () => {
  it("chia hết đúng theo ví dụ: 15 lớp, 5 người -> mỗi người 3 lớp liên tiếp", () => {
    const classIds = Array.from({ length: 15 }, (_, i) => `10A${i + 1}`);
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn", "d@fpt.edu.vn", "e@fpt.edu.vn"];
    const result = distributeClassesSequentially(classIds, judges, "auto");
    expect(result.byJudge.get("a@fpt.edu.vn")).toEqual(["10A1", "10A2", "10A3"]);
    expect(result.byJudge.get("b@fpt.edu.vn")).toEqual(["10A4", "10A5", "10A6"]);
    expect(result.byJudge.get("c@fpt.edu.vn")).toEqual(["10A7", "10A8", "10A9"]);
    expect(result.byJudge.get("d@fpt.edu.vn")).toEqual(["10A10", "10A11", "10A12"]);
    expect(result.byJudge.get("e@fpt.edu.vn")).toEqual(["10A13", "10A14", "10A15"]);
    expect(result.unassignedClassIds).toEqual([]);
  });

  it("chia không hết -> người CUỐI CÙNG nhận phần dư, người khác đều bằng nhau", () => {
    const classIds = Array.from({ length: 16 }, (_, i) => `10A${i + 1}`);
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn", "d@fpt.edu.vn", "e@fpt.edu.vn"];
    const result = distributeClassesSequentially(classIds, judges, "auto");
    expect(result.byJudge.get("a@fpt.edu.vn")).toHaveLength(3);
    expect(result.byJudge.get("b@fpt.edu.vn")).toHaveLength(3);
    expect(result.byJudge.get("c@fpt.edu.vn")).toHaveLength(3);
    expect(result.byJudge.get("d@fpt.edu.vn")).toHaveLength(3);
    expect(result.byJudge.get("e@fpt.edu.vn")).toHaveLength(4); // người cuối nhận dư
    expect(result.byJudge.get("e@fpt.edu.vn")).toEqual(["10A13", "10A14", "10A15", "10A16"]);
    expect(result.unassignedClassIds).toEqual([]);
  });

  it("mỗi người luôn nhận đúng 1 khối LIÊN TIẾP (không ngắt quãng)", () => {
    const classIds = Array.from({ length: 10 }, (_, i) => `10A${i + 1}`);
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn"];
    const result = distributeClassesSequentially(classIds, judges, "auto");
    for (const [, classes] of result.byJudge) {
      const indices = classes.map((id) => classIds.indexOf(id));
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBe(indices[i - 1]! + 1); // liên tiếp trong mảng gốc
      }
    }
    // hợp tất cả = đúng tập lớp ban đầu, không trùng/thiếu
    const all = Array.from(result.byJudge.values()).flat();
    expect(all.sort()).toEqual([...classIds].sort());
  });

  it("nhiều người hơn lớp -> người cuối nhận hết, người khác 0 lớp", () => {
    const classIds = ["10A1", "10A2"];
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn"];
    const result = distributeClassesSequentially(classIds, judges, "auto");
    expect(result.byJudge.get("a@fpt.edu.vn")).toEqual([]);
    expect(result.byJudge.get("b@fpt.edu.vn")).toEqual([]);
    expect(result.byJudge.get("c@fpt.edu.vn")).toEqual(["10A1", "10A2"]);
  });
});

describe("distributeClassesSequentially — chế độ số lớp/người cố định", () => {
  it("cắt đúng K lớp liên tiếp cho từng người theo thứ tự", () => {
    const classIds = Array.from({ length: 10 }, (_, i) => `10A${i + 1}`);
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn", "d@fpt.edu.vn"];
    const result = distributeClassesSequentially(classIds, judges, 3);
    expect(result.byJudge.get("a@fpt.edu.vn")).toEqual(["10A1", "10A2", "10A3"]);
    expect(result.byJudge.get("b@fpt.edu.vn")).toEqual(["10A4", "10A5", "10A6"]);
    expect(result.byJudge.get("c@fpt.edu.vn")).toEqual(["10A7", "10A8", "10A9"]);
    // hết lớp ở người thứ 4 -> chỉ còn 1 lớp cuối
    expect(result.byJudge.get("d@fpt.edu.vn")).toEqual(["10A10"]);
    expect(result.unassignedClassIds).toEqual([]);
  });

  it("không đủ người cho hết lớp ở K cố định -> phần dư trả về unassignedClassIds, KHÔNG dồn vào ai", () => {
    const classIds = Array.from({ length: 10 }, (_, i) => `10A${i + 1}`);
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn"]; // 2 người x 3 lớp = 6, còn dư 4
    const result = distributeClassesSequentially(classIds, judges, 3);
    expect(result.byJudge.get("a@fpt.edu.vn")).toEqual(["10A1", "10A2", "10A3"]);
    expect(result.byJudge.get("b@fpt.edu.vn")).toEqual(["10A4", "10A5", "10A6"]);
    expect(result.unassignedClassIds).toEqual(["10A7", "10A8", "10A9", "10A10"]);
  });

  it("thừa người so với lớp -> người dư không có lớp nào (không lỗi)", () => {
    const classIds = ["10A1", "10A2"];
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn"];
    const result = distributeClassesSequentially(classIds, judges, 3);
    expect(result.byJudge.get("a@fpt.edu.vn")).toEqual(["10A1", "10A2"]);
    expect(result.byJudge.get("b@fpt.edu.vn")).toEqual([]);
    expect(result.byJudge.get("c@fpt.edu.vn")).toEqual([]);
  });
});

describe("distributeClassesSequentially — trường hợp rỗng", () => {
  it("không có lớp -> mọi người 0 lớp, không lỗi", () => {
    const result = distributeClassesSequentially([], ["a@fpt.edu.vn"], "auto");
    expect(result.byJudge.get("a@fpt.edu.vn")).toEqual([]);
    expect(result.unassignedClassIds).toEqual([]);
  });

  it("không có người chấm -> map rỗng", () => {
    const result = distributeClassesSequentially(["10A1"], [], "auto");
    expect(result.byJudge.size).toBe(0);
  });
});
