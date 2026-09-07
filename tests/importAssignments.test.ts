import { describe, it, expect } from "vitest";
import { matchAssignmentRows, groupMatchesByUser } from "@/lib/scoring/importAssignments";

const judges = [
  { email: "a@fpt.edu.vn", name: "Nguyễn Văn A" },
  { email: "b@fpt.edu.vn", name: "Trần Văn B" },
  { email: "trung1@fpt.edu.vn", name: "Lê Văn Trung" },
  { email: "trung2@fpt.edu.vn", name: "Lê Văn Trung" }, // trùng tên có chủ đích
];

const classes = [
  { classId: "c-10a1", className: "10A1" },
  { classId: "c-10a2", className: "10A2" },
];

describe("matchAssignmentRows", () => {
  it("khớp đúng theo email", () => {
    const result = matchAssignmentRows(
      [{ rowIndex: 2, personRaw: "a@fpt.edu.vn", classRaw: "10A1" }],
      judges,
      classes,
    );
    expect(result.errors).toHaveLength(0);
    expect(result.matches).toEqual([
      { rowIndex: 2, userEmail: "a@fpt.edu.vn", userName: "Nguyễn Văn A", classId: "c-10a1", className: "10A1" },
    ]);
  });

  it("khớp theo tên, không phân biệt hoa thường/khoảng trắng thừa, và tên lớp không phân biệt hoa thường", () => {
    const result = matchAssignmentRows(
      [{ rowIndex: 2, personRaw: "  nguyễn văn a  ", classRaw: " 10a1 " }],
      judges,
      classes,
    );
    expect(result.errors).toHaveLength(0);
    expect(result.matches[0]?.userEmail).toBe("a@fpt.edu.vn");
  });

  it("không tìm thấy email -> lỗi, không tạo match", () => {
    const result = matchAssignmentRows(
      [{ rowIndex: 3, personRaw: "khong-ton-tai@fpt.edu.vn", classRaw: "10A1" }],
      judges,
      classes,
    );
    expect(result.matches).toHaveLength(0);
    expect(result.errors[0]?.reason).toMatch(/Không tìm thấy tài khoản/);
  });

  it("không tìm thấy lớp -> lỗi", () => {
    const result = matchAssignmentRows(
      [{ rowIndex: 3, personRaw: "a@fpt.edu.vn", classRaw: "10A99" }],
      judges,
      classes,
    );
    expect(result.matches).toHaveLength(0);
    expect(result.errors[0]?.reason).toMatch(/Không tìm thấy lớp/);
  });

  it("tên trùng nhiều người -> báo lỗi yêu cầu dùng email, KHÔNG tự đoán người nào", () => {
    const result = matchAssignmentRows(
      [{ rowIndex: 4, personRaw: "Lê Văn Trung", classRaw: "10A1" }],
      judges,
      classes,
    );
    expect(result.matches).toHaveLength(0);
    expect(result.errors[0]?.reason).toMatch(/2 người tên/);
  });

  it("dòng trống (cả 2 cột) -> bỏ qua âm thầm, không tính là lỗi", () => {
    const result = matchAssignmentRows(
      [{ rowIndex: 5, personRaw: "", classRaw: "" }],
      judges,
      classes,
    );
    expect(result.matches).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("thiếu 1 trong 2 cột -> lỗi", () => {
    const result = matchAssignmentRows(
      [{ rowIndex: 6, personRaw: "a@fpt.edu.vn", classRaw: "" }],
      judges,
      classes,
    );
    expect(result.errors[0]?.reason).toMatch(/Thiếu/);
  });
});

describe("groupMatchesByUser", () => {
  it("gộp nhiều lớp về đúng 1 người, loại trùng", () => {
    const grouped = groupMatchesByUser([
      { rowIndex: 1, userEmail: "a@fpt.edu.vn", userName: "A", classId: "c-10a1", className: "10A1" },
      { rowIndex: 2, userEmail: "a@fpt.edu.vn", userName: "A", classId: "c-10a2", className: "10A2" },
      { rowIndex: 3, userEmail: "a@fpt.edu.vn", userName: "A", classId: "c-10a1", className: "10A1" },
      { rowIndex: 4, userEmail: "b@fpt.edu.vn", userName: "B", classId: "c-10a2", className: "10A2" },
    ]);
    expect(grouped.get("a@fpt.edu.vn")?.sort()).toEqual(["c-10a1", "c-10a2"]);
    expect(grouped.get("b@fpt.edu.vn")).toEqual(["c-10a2"]);
  });
});
