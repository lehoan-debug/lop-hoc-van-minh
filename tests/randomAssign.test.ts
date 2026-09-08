import { describe, it, expect } from "vitest";
import { randomlyDistributeClasses } from "@/lib/rounds/randomAssign";

/** RNG xác định (không phải Math.random) để test lặp lại được. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("randomlyDistributeClasses", () => {
  it("chia hết, số lớp bằng bội số người -> mỗi người đúng bằng nhau", () => {
    const classIds = ["10A1", "10A2", "10A3", "10A4", "10A5", "10A6"];
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn"];
    const result = randomlyDistributeClasses(classIds, judges, seededRng(42));
    for (const email of judges) {
      expect(result.get(email)).toHaveLength(2);
    }
  });

  it("chia không hết -> chênh lệch tối đa 1 lớp giữa người nhiều nhất và ít nhất", () => {
    const classIds = Array.from({ length: 10 }, (_, i) => `C${i}`);
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn"]; // 10/3 -> 4,3,3
    const result = randomlyDistributeClasses(classIds, judges, seededRng(7));
    const counts = judges.map((j) => result.get(j)!.length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("không trùng lặp, không thiếu lớp nào (hợp tất cả người = đúng tập lớp ban đầu)", () => {
    const classIds = ["10A1", "10A2", "10A3", "10A4", "10A5"];
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn"];
    const result = randomlyDistributeClasses(classIds, judges, seededRng(99));
    const all = Array.from(result.values()).flat();
    expect(all.sort()).toEqual([...classIds].sort());
    expect(new Set(all).size).toBe(classIds.length);
  });

  it("kết quả ngẫu nhiên — RNG khác nhau cho thứ tự phân bổ khác nhau", () => {
    const classIds = Array.from({ length: 12 }, (_, i) => `C${i}`);
    const judges = ["a@fpt.edu.vn", "b@fpt.edu.vn", "c@fpt.edu.vn", "d@fpt.edu.vn"];
    const resultA = randomlyDistributeClasses(classIds, judges, seededRng(1));
    const resultB = randomlyDistributeClasses(classIds, judges, seededRng(2));
    expect(resultA.get("a@fpt.edu.vn")).not.toEqual(resultB.get("a@fpt.edu.vn"));
  });

  it("danh sách lớp rỗng -> mỗi người 0 lớp, không lỗi", () => {
    const result = randomlyDistributeClasses([], ["a@fpt.edu.vn"], seededRng(1));
    expect(result.get("a@fpt.edu.vn")).toEqual([]);
  });

  it("không có người chấm nào -> trả về map rỗng", () => {
    const result = randomlyDistributeClasses(["10A1"], [], seededRng(1));
    expect(result.size).toBe(0);
  });
});
