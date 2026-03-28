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
        <TabsList className="flex gap-6 border-b border-border mb-6 bg-transparent h-auto p-0 rounded-none">
          <TabsTrigger value="overview" className="py-2 px-1 text-sm font-medium transition-colors border-b-2 -mb-px data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-transparent !bg-transparent shadow-none rounded-none">
            Oversikt
          </TabsTrigger>
          <TabsTrigger value="huskeliste" className="py-2 px-1 text-sm font-medium transition-colors border-b-2 -mb-px data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-transparent !bg-transparent shadow-none rounded-none">
            Huskeliste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab notes={notes ?? []} />
        </TabsContent>

        <TabsContent value="huskeliste" className="mt-0">
          <HuskelisteTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
