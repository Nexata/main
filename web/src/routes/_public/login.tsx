import { createFileRoute, redirect } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { IoLogoMicrosoft } from 'react-icons/io5';
import { SiDropbox } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { isAuthenticated } from '@/lib/auth';
import { getDropboxLoginUrl, getGoogleLoginUrl } from '@/lib/oauth';
import {
	'login.meta.title' as login_meta_title,
	'login.oauth.dropbox' as login_oauth_dropbox,
	'login.oauth.google' as login_oauth_google,
	'login.oauth.microsoft' as login_oauth_microsoft,
	'login.subtitle' as login_subtitle,
	'login.title' as login_title,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_public/login')({
	beforeLoad: () => {
		if (isAuthenticated()) {
			throw redirect({ to: '/chat' });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	useEffect(() => {
		document.title = login_meta_title();
	}, []);

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.96 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.25, ease: 'easeOut' }}
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
						{login_title()}
					</h1>
					<p className="text-sm text-muted-foreground text-center mb-6">
						{login_subtitle()}
					</p>

					{/* OAuth */}
					<div className="flex flex-col gap-3">
						<Button
							variant="outline"
							className="h-11 gap-3 cursor-pointer"
							onClick={async () => {
								var url = await getGoogleLoginUrl()
								window.location.href = url;
							}}
						>
							<FcGoogle className="h-5 w-5" />
							{login_oauth_google()}
						</Button>

						<Button variant="outline" className="h-11 gap-3 cursor-pointer">
							<IoLogoMicrosoft className="h-5 w-5 text-blue-500" />
							{login_oauth_microsoft()}
						</Button>

						<Button
							variant="outline"
							className="h-11 gap-3 cursor-pointer"
							onClick={async () => {
								var url = await getDropboxLoginUrl();
								window.location.href = url;
							}}
						>
							<SiDropbox className="h-5 w-5 text-[#0061FF]" />
							{login_oauth_dropbox()}
						</Button>

						<Separator className="my-1" />
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
