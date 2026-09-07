import { getSettings, getClasses } from "@/lib/google/sheets";
import { SettingsPanels } from "@/components/admin/SettingsPanels";

export default async function AdminSettingsPage() {
  const [settings, classes] = await Promise.all([getSettings(), getClasses()]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Cấu hình hệ thống</h1>
      <SettingsPanels settings={settings} classes={classes} />
    </div>
  );
}
