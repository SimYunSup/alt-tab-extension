import { Button } from "@/entrypoints/components/ui/button";
import { useToken } from "../../popup/hooks/useStorageValue";
import GoogleLogoIcon from "../../../assets/google.svg?react";

// TODO:
export const ArchiveTabs = () => {
  const hasToken = useToken();
  if (!hasToken) {
    return (
      null
    );
  }
  const onClickLoginButton = async () => {
    const result = await chrome.identity.launchWebAuthFlow({
      url: `${import.meta.env.VITE_OAUTH_BASE_URL}/oauth/google`,
      interactive: true,
    }, response => console.log(response));
  }
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Button
        variant="secondary"
        onClick={onClickLoginButton}
        className="flex items-center gap-2 cursor-pointer"
      >
        <GoogleLogoIcon />
        구글 로그인
      </Button>
    </div>
  )
}
