import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { saveTokens } from "@/lib/auth";
import React from "react";

export const Route = createFileRoute("/_public/callback")({
  component: CallbackPage,
});

export default function CallbackPage() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("at");
    const refreshToken = params.get("rt");

    if (accessToken && refreshToken) {
      saveTokens(accessToken, refreshToken);
      navigate({ to: "/chat" });
    } else {
      navigate({ to: "/login" });
    }
  }, []);

  return null;
}
