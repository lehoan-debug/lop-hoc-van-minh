import { getSettings, getClasses, getCriteria } from "@/lib/google/sheets";
import { SettingsPanels } from "@/components/admin/SettingsPanels";

export default async function AdminSettingsPage() {
  const [settings, classes, criteria] = await Promise.all([
    getSettings(),
    getClasses(),
    getCriteria(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Cấu hình hệ thống</h1>
      <SettingsPanels settings={settings} classes={classes} criteria={criteria} />
    </div>
  );
}
