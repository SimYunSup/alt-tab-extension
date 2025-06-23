import { browser } from "#imports"
import { useToken } from "@/entrypoints/popup/hooks/useStorageValue";
import GoogleLogoIcon from "../../../assets/google.svg?react";
import { Button } from "../ui/button";

export function Login() {
  const [hasToken, resetToken] = useToken();
  const onClickLoginButton = () => {
    browser.identity.launchWebAuthFlow({
      url: `${import.meta.env.VITE_OAUTH_BASE_URL}/oauth/google`,
      interactive: true,
    }, response => console.log(response));
  }
  return (
    <div>
      {hasToken ? (
        <Button
          variant="secondary"
          onClick={onClickLoginButton}
          className="flex items-center gap-2 cursor-pointer"
        >
          <GoogleLogoIcon />
          구글 로그인
        </Button>
      ) : (
        <div className="flex items-center justify-center h-full">
          <Button className="text-sm" onClick={resetToken}>
            로그아웃
          </Button>
        </div>
      )}
    </div>
  )
}
