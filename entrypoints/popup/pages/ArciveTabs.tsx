import { browser } from "wxt/browser";
import { Button } from "@/entrypoints/components/ui/button";
import { useToken } from "@/entrypoints/popup/hooks/useStorageValue";
import { Login } from "@/entrypoints/components/Login";

// TODO:
export const ArchiveTabs = () => {
  const hasToken = useToken();
  if (!hasToken) {
    return (
      <Login />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-full">
    </div>
  )
}
