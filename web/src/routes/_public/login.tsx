import { useEffect } from "react";
import { motion } from "framer-motion";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { IoLogoMicrosoft } from "react-icons/io5";
import { SiDropbox } from "react-icons/si";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import * as m from "@/paraglide/messages.js";
import { isAuthenticated } from "@/lib/auth";
import { getDropboxLoginUrl, getGoogleLoginUrl } from "@/lib/oauth";

export const Route = createFileRoute("/_public/login")({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: "/chat" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
	useEffect(() => { document.title = m["login.meta.title"]() }, [])

	return (
		<>
			<motion.div
				initial={{ opacity: 0, scale: 0.96 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.25, ease: "easeOut" }}
				className="w-full max-w-md"
			>
				<Card className="rounded-2xl border shadow-xl">
					<CardContent className="p-8">
						{/* Logos */}
						<div className="flex items-center justify-center gap-4 mb-8">
							<img
								src="/nexata_logo.png"
								alt="Nexata"
								className="h-10 w-auto object-contain"
							/>
							<div className="h-8 w-px bg-border" />
							<img
								src="/company_logo.png"
								alt="Empresa"
								className="h-8 w-auto object-contain opacity-80"
							/>
						</div>

						{/* Title */}
						<h1 className="text-2xl font-semibold text-center mb-2">
							{m["login.title"]()}
						</h1>
						<p className="text-sm text-muted-foreground text-center mb-6">
							{m["login.subtitle"]()}
						</p>

						{/* OAuth */}
						<div className="flex flex-col gap-3">
							<Button
							variant="outline"
							className="h-11 gap-3 cursor-pointer"
							onClick={() => {
								window.location.href = getGoogleLoginUrl();
							}}>
								<FcGoogle className="h-5 w-5" />
								{m["login.oauth.google"]()}
							</Button>

							<Button variant="outline" className="h-11 gap-3 cursor-pointer">
								<IoLogoMicrosoft className="h-5 w-5 text-blue-500" />
								{m["login.oauth.microsoft"]()}
							</Button>

							<Button
							variant="outline"
							className="h-11 gap-3 cursor-pointer"
							onClick={() => {
								window.location.href = getDropboxLoginUrl();
							}}>
								<SiDropbox className="h-5 w-5 text-[#0061FF]" />
								{m["login.oauth.dropbox"]()}
							</Button>

							<Separator className="my-1" />
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</>
	)
}
