import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { IoLogoMicrosoft } from "react-icons/io5";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import * as m from "@/paraglide/messages.js";

export const Route = createFileRoute("/_public/login")({
	component: LoginPage,
});

function LoginPage() {
	useEffect(() => { document.title = m["login.meta.title"]() }, [])

	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		setTimeout(() => {
			setLoading(false);
			navigate({ to: "/chat" });
		}, 800);
	}

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

						{/* Form */}
						<form onSubmit={handleSubmit} className="space-y-4">
							<Input
								type="email"
								required
								placeholder={m["login.email"]()}
								className="h-11"
							/>

							<Input
								type="password"
								required
								placeholder={m["login.password"]()}
								className="h-11"
							/>

							<Button
								type="submit"
								disabled={loading}
								className="
									w-full h-11 text-sm font-medium
									cursor-pointer
									transition-all duration-150
									hover:bg-primary/65
									active:bg-primary/55
								"
							>
								{loading
									? m["login.loading"]()
									: m["login.submit"]()}
							</Button>
						</form>

						<Separator className="my-6" />

						{/* OAuth */}
						<div className="flex flex-col gap-3">
							<Button variant="outline" className="h-11 gap-3 cursor-pointer">
								<FcGoogle className="h-5 w-5" />
								{m["login.oauth.google"]()}
							</Button>
							<Button variant="outline" className="h-11 gap-3 cursor-pointer">
								<IoLogoMicrosoft className="h-5 w-5 text-blue-500" />
								{m["login.oauth.microsoft"]()}
							</Button>
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</>
	)
}
