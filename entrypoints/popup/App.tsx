import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/entrypoints/components/ui/tabs';
import { CurrentTabs } from './pages/CurrentTabs';
function App() {
  return (
    <div className="app-container">
      <Tabs defaultValue="tab-current" className="flex flex-col w-full h-full mx-auto bg-background">
        <TabsList className="w-full flex gap-2">
          <TabsTrigger value="tab-current">
            현재 탭
          </TabsTrigger>
          <TabsTrigger value="tab-store">
            저장된 탭
          </TabsTrigger>
          <TabsTrigger value="tab-status">
            탭 상태
          </TabsTrigger>
          <TabsTrigger value="tab-settings">
            탭 설정
          </TabsTrigger>
        </TabsList>
        <TabsContent className="flex-1" value="tab-current">
          <CurrentTabs />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
