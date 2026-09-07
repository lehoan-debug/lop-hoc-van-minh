import { describe, it, expect } from "vitest";
import { matchImportUserRows } from "@/lib/admin/importUsers";

const classes = [
  { classId: "c-10a1", className: "10A1" },
  { classId: "c-10a2", className: "10A2" },
];

function row(overrides: Partial<{ rowIndex: number; emailRaw: string; nameRaw: string; rolesRaw: string; homeroomClassesRaw: string }> = {}) {
  return {
    rowIndex: 2,
    emailRaw: "a@fpt.edu.vn",
    nameRaw: "Nguyễn Văn A",
    rolesRaw: "JUDGE",
    homeroomClassesRaw: "",
    ...overrides,
  };
}

describe("matchImportUserRows", () => {
  it("khớp đúng với mã vai trò kỹ thuật", () => {
    const result = matchImportUserRows([row()], classes);
    expect(result.errors).toHaveLength(0);
    expect(result.matches[0]).toEqual({
      rowIndex: 2,
      email: "a@fpt.edu.vn",
      name: "Nguyễn Văn A",
      roles: ["JUDGE"],
      homeroomClassIds: [],
    });
  });

  it("khớp nhãn tiếng Việt, nhiều vai trò cách nhau bởi dấu phẩy, không phân biệt hoa thường", () => {
    const result = matchImportUserRows(
      [row({ rolesRaw: "giám khảo, GVCN", homeroomClassesRaw: "10A1" })],
      classes,
    );
    expect(result.errors).toHaveLength(0);
    expect(result.matches[0]?.roles.sort()).toEqual(["HOMEROOM_TEACHER", "JUDGE"]);
    expect(result.matches[0]?.homeroomClassIds).toEqual(["c-10a1"]);
  });

  it("nhiều lớp chủ nhiệm cách nhau bởi dấu chấm phẩy", () => {
    const result = matchImportUserRows(
      [row({ rolesRaw: "HOMEROOM_TEACHER", homeroomClassesRaw: "10A1; 10A2" })],
      classes,
    );
    expect(result.matches[0]?.homeroomClassIds.sort()).toEqual(["c-10a1", "c-10a2"]);
  });

  it("email không hợp lệ -> lỗi", () => {
    const result = matchImportUserRows([row({ emailRaw: "khong-hop-le" })], classes);
    expect(result.matches).toHaveLength(0);
    expect(result.errors[0]?.reason).toMatch(/Email không hợp lệ/);
  });

  it("thiếu tên -> lỗi", () => {
    const result = matchImportUserRows([row({ nameRaw: "" })], classes);
    expect(result.errors[0]?.reason).toMatch(/Thiếu họ tên/);
  });

  it("vai trò không hợp lệ -> lỗi rõ ràng, không tự đoán", () => {
    const result = matchImportUserRows([row({ rolesRaw: "SIEU_NHAN" })], classes);
    expect(result.matches).toHaveLength(0);
    expect(result.errors[0]?.reason).toMatch(/Vai trò không hợp lệ/);
  });

  it("tên lớp chủ nhiệm không tồn tại -> lỗi", () => {
    const result = matchImportUserRows(
      [row({ rolesRaw: "HOMEROOM_TEACHER", homeroomClassesRaw: "10A99" })],
      classes,
    );
    expect(result.errors[0]?.reason).toMatch(/Không tìm thấy lớp/);
  });

  it("dòng trống hoàn toàn -> bỏ qua âm thầm", () => {
    const result = matchImportUserRows(
      [row({ emailRaw: "", nameRaw: "", rolesRaw: "", homeroomClassesRaw: "" })],
      classes,
    );
    expect(result.matches).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
