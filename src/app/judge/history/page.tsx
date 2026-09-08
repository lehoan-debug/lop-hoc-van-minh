import { requireUser } from "@/lib/auth/session";
import { getScores, getCriteria, getAdjustments } from "@/lib/google/sheets";
import { HistoryList } from "@/components/scoring/HistoryList";

export default async function JudgeHistoryPage() {
  const user = await requireUser();
  const [scores, criteria, adjustments] = await Promise.all([
    getScores({ judgeEmail: user.email }),
    getCriteria({ activeOnly: true }),
    getAdjustments(),
  ]);

  const sorted = [...scores].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-lg font-bold">Lịch sử chấm điểm</h1>
      <HistoryList scores={sorted} criteria={criteria} adjustments={adjustments} />
    </div>
  );
}
