"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function RankingTabsShell({
  tab10,
  tab11,
  tab12,
}: {
  tab10: React.ReactNode;
  tab11: React.ReactNode;
  tab12: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="10">
      <TabsList>
        <TabsTrigger value="10">Khối 10</TabsTrigger>
        <TabsTrigger value="11">Khối 11</TabsTrigger>
        <TabsTrigger value="12">Khối 12</TabsTrigger>
      </TabsList>
      <TabsContent value="10">{tab10}</TabsContent>
      <TabsContent value="11">{tab11}</TabsContent>
      <TabsContent value="12">{tab12}</TabsContent>
    </Tabs>
  );
}
