import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { OverviewTab } from "@/components/prosesslogg/OverviewTab";
import { HuskelisteTab } from "@/components/prosesslogg/HuskelisteTab";
import { useProsessloggNotes } from "@/hooks/useProsesslogg";

export default function ProcessLogExportPage() {
  const { data: notes } = useProsessloggNotes();

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Prosesslogg"
        description="Samle notater, skriv og eksporter prosessloggen"
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Oversikt</TabsTrigger>
          <TabsTrigger value="huskeliste">Huskeliste</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab notes={notes ?? []} />
        </TabsContent>

        <TabsContent value="huskeliste" className="mt-4">
          <HuskelisteTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
