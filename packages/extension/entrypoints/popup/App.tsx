import React from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/entrypoints/components/ui/tabs';
import { CurrentTabs } from './pages/CurrentTabs';
import { useToken } from './hooks/useStorageValue';

const Setting = React.lazy(() => import('./pages/Setting').then(module => ({ default: module.Setting })));
const RecordTabs = React.lazy(() => import('./pages/RecordTabs').then(module => ({ default: module.RecordTabs })));
const ArchiveTabs = React.lazy(() => import('./pages/ArchiveTabs').then(module => ({ default: module.ArchiveTabs })));

function App() {
  const [token] = useToken();

  return (
    <div className="app-container">
      <Tabs defaultValue="tab-current" className="flex flex-col w-full h-full mx-auto bg-background">
        <TabsList className="flex-initial w-full flex gap-2">
          <TabsTrigger value="tab-current">
            현재 탭
          </TabsTrigger>
          <TabsTrigger value="tab-store">
            닫힌 탭
          </TabsTrigger>
          {token && (
            <TabsTrigger value="tab-archive">
              아카이브 탭
            </TabsTrigger>
          )}
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
        {token && (
          <TabsContent className="h-full flex-1" value="tab-archive">
            <ArchiveTabs />
          </TabsContent>
        )}
        <TabsContent className="h-full flex-1" value="tab-settings">
          <Setting />
        </TabsContent>
      </Tabs>
      <div id="portal-container" />
    </div>
  );
}

export default App;
