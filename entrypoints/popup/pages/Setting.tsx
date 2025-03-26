import type { InactiveType, CloseRules } from "@/types/data"

import { Button } from "@/entrypoints/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/entrypoints/components/ui/card"
import { Input } from "@/entrypoints/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/entrypoints/components/ui/tabs"
import { Save, PlusCircle, Trash2 } from "lucide-react"
import { Label } from "@/entrypoints/components/ui/label"
import { Slider } from "@/entrypoints/components/ui/slider"
import { Separator } from "@/entrypoints/components/ui/separator"
import { ScrollArea } from "@/entrypoints/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/entrypoints/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/entrypoints/components/ui/table"
import { Switch } from "@/entrypoints/components/ui/switch"
import { useSetting } from "../hooks/useBackground"
import { Badge } from "@/entrypoints/components/ui/badge"

export function Setting() {
  const [_settings, set_Settings] = useSetting();
  const [settings, setSettings] = useState(() => _settings ?? DEFAULT_SETTING);
  const [newBlocklistItem, setNewBlocklistItem] = useState({
    url: "",
    rule: {
      idleCondition: "window" as InactiveType,
      idleThreshold: 60,
      mutedTabIgnore: false,
      pinnedTabIgnore: false,
    },
  })

  const handleCloseRulesChange = (field: keyof CloseRules, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      closeRules: {
        ...settings.closeRules,
        [field]: value,
      },
    })
  }

  const handleGeneralSettingChange = (field: keyof Omit<Setting, "closeRules" | "blocklist">, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [field]: value,
    })
  }

  const addBlocklistItem = () => {
    if (!settings) return;
    if (!newBlocklistItem.url) return

    setSettings({
      ...settings,
      blocklist: [...settings.blocklist, { ...newBlocklistItem }],
    })

    setNewBlocklistItem({
      url: "",
      rule: {
        idleCondition: "window",
        idleThreshold: 60,
        mutedTabIgnore: false,
        pinnedTabIgnore: false,
      },
    })
  }

  const removeBlocklistItem = (index: number) => {
    if (!settings) return;
    const newBlocklist = [...settings.blocklist]
    newBlocklist.splice(index, 1)
    setSettings({
      ...settings,
      blocklist: newBlocklist,
    })
  }

  const handleNewBlocklistItemChange = (field: string, value: any) => {
    if (field.startsWith("rule.")) {
      const ruleField = field.split(".")[1] as keyof typeof newBlocklistItem.rule
      setNewBlocklistItem({
        ...newBlocklistItem,
        rule: {
          ...newBlocklistItem.rule,
          [ruleField]: value,
        },
      })
    } else {
      setNewBlocklistItem({
        ...newBlocklistItem,
        [field]: value,
      })
    }
  }

  const saveSettings = () => {
    // Here you would typically save the settings to storage or send to a server
    console.log("Saving settings:", settings)
    // Show a success message or notification
    alert("Settings saved successfully!")
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} 분`
    } else {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
    }
  }

  const getInactiveTypeLabel = (type: InactiveType) => {
    switch (type) {
      case "window":
        return "윈도우 변경 시"
      case "visiblity":
        return "탭 숨김 시"
      case "idle":
        return "활동 없을 시"
    }
  }

  const handleIdleThresholdInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isBlocklistItem = false,
    blocklistIndex?: number,
  ) => {
    const value = Number.parseInt(e.target.value)
    if (isNaN(value)) return

    if (isBlocklistItem) {
      if (blocklistIndex !== undefined) {
        if (!settings) return;
        const newBlocklist = [...settings.blocklist]
        newBlocklist[blocklistIndex].rule.idleThreshold = value
        setSettings({
          ...settings,
          blocklist: newBlocklist,
        })
      } else {
        handleNewBlocklistItemChange("rule.idleThreshold", value)
      }
    } else {
      handleCloseRulesChange("idleThreshold", value)
    }
  }

  if (!settings) return null;

  return (
    <div className="w-full h-[450px]">
      <Tabs defaultValue="general" className="w-full flex flex-col">
        <TabsList className="grid grid-cols-3 mb-4 w-full">
          <TabsTrigger value="general">일반 설정</TabsTrigger>
          <TabsTrigger value="close-rules">닫기 규칙</TabsTrigger>
          <TabsTrigger value="blocklist">예외 사이트</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex-1">
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle>일반 설정</CardTitle>
              <CardDescription>기본 설정을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex gap-4 items-center">
                  <Slider
                    id="refreshInterval"
                    min={1}
                    max={12 * 60}
                    value={[settings.refreshInterval]}
                    onValueChange={(value) => handleGeneralSettingChange("refreshInterval", value[0])}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={12 * 60}
                    value={settings.refreshInterval}
                    onChange={(e) =>
                      handleGeneralSettingChange("refreshInterval", Number.parseInt(e.target.value) || 15)
                    }
                    className="w-20"
                  />
                </div>
                <p className="text-sm text-muted-foreground">탭 상태를 확인하는 주기를 설정합니다.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveSettings} className="ml-auto">
                <Save className="mr-2 h-4 w-4" />
                설정 저장
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent
          value="close-rules"
          className="h-full"
        >
          <Card className="overflow-y-auto h-full overflow-x-hidden">
            <CardHeader>
              <CardTitle>닫기 규칙 설정</CardTitle>
              <CardDescription>탭이 자동으로 닫히는 조건을 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="idleCondition">비활성 조건</Label>
                <Select
                  value={settings.closeRules.idleCondition}
                  onValueChange={(value) => handleCloseRulesChange("idleCondition", value as InactiveType)}
                >
                  <SelectTrigger id="idleCondition">
                    <SelectValue placeholder="비활성 조건 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="window">윈도우 변경 시</SelectItem>
                    <SelectItem value="visiblity">탭 숨김 시</SelectItem>
                    <SelectItem value="idle">탭 활동 없을 시</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">탭이 비활성 상태로 간주되는 조건을 선택합니다.</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="idleThreshold">비활성 시간</Label>
                  <span className="text-sm text-muted-foreground">{formatTime(settings.closeRules.idleThreshold)}</span>
                </div>
                <div className="flex gap-4 items-center">
                  <Slider
                    id="idleThreshold"
                    min={1}
                    max={240}
                    step={1}
                    value={[settings.closeRules.idleThreshold]}
                    onValueChange={(value) => handleCloseRulesChange("idleThreshold", value[0])}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={240}
                    value={settings.closeRules.idleThreshold}
                    onChange={(e) => handleIdleThresholdInputChange(e)}
                    className="w-20"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  탭이 닫히기 전에 비활성 상태로 유지되는 시간을 설정합니다. (분 단위)
                </p>
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mutedTabIgnore">음소거된 탭 무시</Label>
                    <p className="text-sm text-muted-foreground">음소거된 탭은 자동으로 닫지 않습니다.</p>
                  </div>
                  <Switch
                    id="mutedTabIgnore"
                    checked={settings.closeRules.mutedTabIgnore}
                    onCheckedChange={(checked) => handleCloseRulesChange("mutedTabIgnore", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="pinnedTabIgnore">고정된 탭 무시</Label>
                    <p className="text-sm text-muted-foreground">고정된 탭은 자동으로 닫지 않습니다.</p>
                  </div>
                  <Switch
                    id="pinnedTabIgnore"
                    checked={settings.closeRules.pinnedTabIgnore}
                    onCheckedChange={(checked) => handleCloseRulesChange("pinnedTabIgnore", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="containerTabIgnore">컨테이너 탭 무시</Label>
                    <p className="text-sm text-muted-foreground">컨테이너 탭은 자동으로 닫지 않습니다.</p>
                  </div>
                  <Switch
                    id="containerTabIgnore"
                    checked={settings.closeRules.containerTabIgnore}
                    onCheckedChange={(checked) => handleCloseRulesChange("containerTabIgnore", checked)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveSettings} className="ml-auto">
                <Save className="mr-2 h-4 w-4" />
                설정 저장
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent
          value="blocklist"
          className="h-full"
        >
          <Card className="overflow-y-auto h-full overflow-x-hidden">
            <CardHeader>
              <CardTitle>예외 사이트 설정</CardTitle>
              <CardDescription>특정 사이트에 대해 다른 닫기 규칙을 적용합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="blocklistUrl" className="text-right">
                      URL
                    </Label>
                    <Input
                      id="blocklistUrl"
                      placeholder="example.com"
                      className="col-span-3"
                      value={newBlocklistItem.url}
                      onChange={(e) => handleNewBlocklistItemChange("url", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="blocklistIdleCondition" className="text-right">
                      비활성 조건
                    </Label>
                    <Select
                      value={newBlocklistItem.rule.idleCondition}
                      onValueChange={(value) =>
                        handleNewBlocklistItemChange("rule.idleCondition", value as InactiveType)
                      }
                    >
                      <SelectTrigger id="blocklistIdleCondition" className="col-span-3">
                        <SelectValue placeholder="비활성 조건 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="window">윈도우 변경 시</SelectItem>
                        <SelectItem value="visiblity">탭 숨김 시</SelectItem>
                        <SelectItem value="idle">활동 없을 시</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="blocklistIdleThreshold" className="text-right">
                      비활성 시간
                    </Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <Slider
                        id="blocklistIdleThreshold"
                        min={1}
                        max={240}
                        step={1}
                        value={[newBlocklistItem.rule.idleThreshold]}
                        onValueChange={(value) => handleNewBlocklistItemChange("rule.idleThreshold", value[0])}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={240}
                        value={newBlocklistItem.rule.idleThreshold}
                        onChange={(e) => handleIdleThresholdInputChange(e, true)}
                        className="w-20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">옵션</Label>
                    <div className="col-span-3 flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="blocklistMutedTabIgnore"
                          checked={newBlocklistItem.rule.mutedTabIgnore}
                          onCheckedChange={(checked) => handleNewBlocklistItemChange("rule.mutedTabIgnore", checked)}
                        />
                        <Label htmlFor="blocklistMutedTabIgnore">음소거된 탭 무시</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="blocklistPinnedTabIgnore"
                          checked={newBlocklistItem.rule.pinnedTabIgnore}
                          onCheckedChange={(checked) => handleNewBlocklistItemChange("rule.pinnedTabIgnore", checked)}
                        />
                        <Label htmlFor="blocklistPinnedTabIgnore">고정된 탭 무시</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <Button onClick={addBlocklistItem} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  예외 사이트 추가
                </Button>

                <Separator className="my-4" />

                <div className="rounded-md border">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">URL</TableHead>
                          <TableHead className="text-xs">비활성 조건</TableHead>
                          <TableHead className="text-xs">비활성 시간</TableHead>
                          {/* <TableHead className="text-xs">옵션</TableHead> */}
                          <TableHead className="w-[100px] text-xs">관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.blocklist.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-xs font-medium">{item.url}</TableCell>
                            <TableCell className="text-xs">{getInactiveTypeLabel(item.rule.idleCondition)}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex justify-center items-center gap-2">
                                <span>{formatTime(item.rule.idleThreshold)}</span>
                              </div>
                            </TableCell>
                            {/* <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.rule.mutedTabIgnore && (
                                  <Badge variant="default" className="text-xs">
                                    음소거 무시
                                  </Badge>
                                )}
                                {item.rule.pinnedTabIgnore && (
                                  <Badge variant="default" className="text-xs">
                                    고정 무시
                                  </Badge>
                                )}
                              </div>
                            </TableCell> */}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeBlocklistItem(index)}
                                className="size-6"
                                style={{ padding: 0}}
                              >
                                <Trash2 className="text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveSettings} className="ml-auto">
                <Save className="mr-2 h-4 w-4" />
                설정 저장
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
