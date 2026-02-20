import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { saveTokens } from '@/lib/auth';
import { Separator } from '@/components/ui/separator';
import React from 'react';

type Session = {
	at: string;
	rt: string;
	user: {
		id: string;
		email: string;
		displayName?: string;
		pfpUrl?: string | null;
	};
	tenant: {
		slug: string;
		displayName: string;
		logoUrl?: string | null;
	};
};

export const Route = createFileRoute('/_public/tenant-selection')({
	component: TenantSelectionPage,
});

function stringToColor(str: string) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
	return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

export default function TenantSelectionPage() {
  const navigate = useNavigate();
  const { sessions: encoded } = useSearch({
    from: '/_public/tenant-selection',
  });

  const sessions: Session[] | null = React.useMemo(() => {
    try {
      if (!encoded) return null;
      return JSON.parse(atob(decodeURIComponent(encoded)));
    } catch {
      return null;
    }
  }, [encoded]);

  React.useEffect(() => {
    if (!sessions?.length) {
      navigate({ to: '/login' });
    }
  }, [sessions, navigate]);

  if (!sessions?.length) return null;

  const user = sessions[0]?.user;
  if (!user) return;

	function selectSession(session: Session) {
		saveTokens(session.at, session.rt);
		navigate({ to: '/chat' });
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.96 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.25 }}
			className="w-full max-w-xl space-y-6"
		>
			<Card className="rounded-2xl border shadow-xl">
				<CardContent className="p-8 space-y-6">

					{/* Logo */}
					{/*<div className="flex justify-center">
						<img
							src="/nexata_logo.png"
							alt="Nexata"
							className="h-12 object-contain"
						/>
					</div>*/}

					{/* User greeting */}
					<div className="flex flex-col items-center gap-3">

						{user.pfpUrl ? (
							<img
								src={user.pfpUrl}
								className="w-16 h-16 rounded-full object-cover"
								referrerPolicy="no-referrer"
							/>
						) : (
							<div
								className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold"
								style={{
									backgroundColor: stringToColor(user.displayName ?? user.email),
									fontSize: 24,
								}}
							>
								{(user.displayName ?? user.email)[0]?.toUpperCase()}
							</div>
						)}

						<h2 className="text-xl font-semibold text-center">
							Bienvenido {user.displayName ?? ''}
						</h2>

						<p className="text-sm text-muted-foreground">
							{user.email}
						</p>
						<Separator className="my-1" />
						<p className="text-sm opacity-70 text-center">
							Seleccioná el tenant al que querés ingresar
            </p>
					</div>

					{/* Tenant list */}
					<div className="space-y-3">
						{sessions.map((s, i) => (
							<motion.button
								key={i}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
								onClick={() => selectSession(s)}
								className="w-full rounded-xl border p-4 flex items-center gap-4 hover:bg-muted transition"
							>
								{s.tenant.logoUrl ? (
									<img
										src={s.tenant.logoUrl}
										className="w-10 h-10 rounded-md object-cover"
									/>
								) : (
									<div
										className="w-10 h-10 rounded-md flex items-center justify-center text-white font-semibold"
										style={{
											backgroundColor: stringToColor(s.tenant.displayName),
										}}
									>
										{s.tenant.displayName[0]}
									</div>
								)}

								<div className="text-left">
									<div className="font-semibold">
										{s.tenant.displayName}
									</div>
									<div className="text-xs opacity-60">
										{s.tenant.slug}
									</div>
								</div>
							</motion.button>
						))}
					</div>

				</CardContent>
			</Card>
		</motion.div>
	);
}
