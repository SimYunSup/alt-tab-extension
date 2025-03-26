import { Button } from "@/entrypoints/components/ui/button";
import GoogleLogoIcon from "@/assets/google-logo.svg?react";

export const Login = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Button>
        <GoogleLogoIcon />
        구글 로그인
      </Button>
    </div>
  )
}