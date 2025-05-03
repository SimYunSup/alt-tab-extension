import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/entrypoints/components/ui/tabs';
import { CurrentTabs } from './pages/CurrentTabs';
import { Setting } from './pages/Setting';
import { RecordTabs } from './pages/RecordTabs';
// import { ArchiveTabs } from './pages/ArchiveTabs';

function App() {
  return (
    <div className="app-container">
      <Tabs defaultValue="tab-current" className="flex flex-col w-full h-full mx-auto bg-background">
        <TabsList className="flex-initial w-full flex gap-2">
          <TabsTrigger value="tab-current">
            현재 탭
          </TabsTrigger>
          <TabsTrigger value="tab-store">
            저장된 탭
          </TabsTrigger>
          <TabsTrigger value="tab-settings">
            탭 설정
          </TabsTrigger>
        </TabsList>
        <TabsContent className="h-full flex-1" value="tab-current">
          <CurrentTabs />
        </TabsContent>
        <TabsContent className="h-full flex-1" value="tab-store">
          <RecordTabs />
        </TabsContent>
        <TabsContent className="h-full flex-1" value="tab-settings">
          <Setting />
        </TabsContent>
      </Tabs>
      <div id="portal-container" />
    </div>
  );
}

export default App;
