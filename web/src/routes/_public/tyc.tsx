import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar/navbar';
import { Footer } from '@/components/footer/footer';
import { usePersistedLanguage } from '@/hooks/use-sync-language';
import {
	'navbar.nav_home' as navbar_nav_home,
	'navbar.nav_platform' as navbar_nav_platform,
	'navbar.nav_nexy' as navbar_nav_nexy,
	'navbar.nav_use_cases' as navbar_nav_use_cases,
	'navbar.nav_features' as navbar_nav_features,
	'tyc.title' as tyc_title,
	'tyc.last_updated' as tyc_last_updated,
	'tyc.acceptance.title' as tyc_acceptance_title,
	'tyc.acceptance.p1' as tyc_acceptance_p1,
	'tyc.description.title' as tyc_description_title,
	'tyc.description.p1' as tyc_description_p1,
	'tyc.description.item_1' as tyc_description_item_1,
	'tyc.description.item_2' as tyc_description_item_2,
	'tyc.description.item_3' as tyc_description_item_3,
	'tyc.description.item_4' as tyc_description_item_4,
	'tyc.description.infocard' as tyc_description_infocard,
	'tyc.definitions.title' as tyc_definitions_title,
	'tyc.definitions.user_label' as tyc_definitions_user_label,
	'tyc.definitions.user_desc' as tyc_definitions_user_desc,
	'tyc.definitions.tenant_label' as tyc_definitions_tenant_label,
	'tyc.definitions.tenant_desc' as tyc_definitions_tenant_desc,
	'tyc.definitions.tenant_admin_label' as tyc_definitions_tenant_admin_label,
	'tyc.definitions.tenant_admin_desc' as tyc_definitions_tenant_admin_desc,
	'tyc.definitions.regular_user_label' as tyc_definitions_regular_user_label,
	'tyc.definitions.regular_user_desc' as tyc_definitions_regular_user_desc,
	'tyc.definitions.connected_sources_label' as tyc_definitions_connected_sources_label,
	'tyc.definitions.connected_sources_desc' as tyc_definitions_connected_sources_desc,
	'tyc.definitions.ingested_data_label' as tyc_definitions_ingested_data_label,
	'tyc.definitions.ingested_data_desc' as tyc_definitions_ingested_data_desc,
	'tyc.definitions.external_data_label' as tyc_definitions_external_data_label,
	'tyc.definitions.external_data_desc' as tyc_definitions_external_data_desc,
	'tyc.obligations.title' as tyc_obligations_title,
	'tyc.obligations.s41_title' as tyc_obligations_s41_title,
	'tyc.obligations.s41_intro' as tyc_obligations_s41_intro,
	'tyc.obligations.s41_item_1' as tyc_obligations_s41_item_1,
	'tyc.obligations.s41_item_2' as tyc_obligations_s41_item_2,
	'tyc.obligations.s41_item_3' as tyc_obligations_s41_item_3,
	'tyc.obligations.s41_item_4' as tyc_obligations_s41_item_4,
	'tyc.obligations.s42_title' as tyc_obligations_s42_title,
	'tyc.obligations.s42_intro' as tyc_obligations_s42_intro,
	'tyc.obligations.s42_item_1' as tyc_obligations_s42_item_1,
	'tyc.obligations.s42_item_2' as tyc_obligations_s42_item_2,
	'tyc.obligations.s42_item_3' as tyc_obligations_s42_item_3,
	'tyc.obligations.s42_item_4' as tyc_obligations_s42_item_4,
	'tyc.obligations.s42_item_5' as tyc_obligations_s42_item_5,
	'tyc.obligations.s43_title' as tyc_obligations_s43_title,
	'tyc.obligations.s43_intro' as tyc_obligations_s43_intro,
	'tyc.obligations.s43_item_1' as tyc_obligations_s43_item_1,
	'tyc.obligations.s43_item_2' as tyc_obligations_s43_item_2,
	'tyc.obligations.s43_item_3' as tyc_obligations_s43_item_3,
	'tyc.ip.title' as tyc_ip_title,
	'tyc.ip.item_1' as tyc_ip_item_1,
	'tyc.ip.item_2' as tyc_ip_item_2,
	'tyc.ip.item_3' as tyc_ip_item_3,
	'tyc.liability.title' as tyc_liability_title,
	'tyc.liability.s61_title' as tyc_liability_s61_title,
	'tyc.liability.s61_intro' as tyc_liability_s61_intro,
	'tyc.liability.s61_item_1' as tyc_liability_s61_item_1,
	'tyc.liability.s61_item_2' as tyc_liability_s61_item_2,
	'tyc.liability.s61_item_3' as tyc_liability_s61_item_3,
	'tyc.liability.s61_item_4' as tyc_liability_s61_item_4,
	'tyc.liability.s62_title' as tyc_liability_s62_title,
	'tyc.liability.s62_intro' as tyc_liability_s62_intro,
	'tyc.liability.s62_item_1' as tyc_liability_s62_item_1,
	'tyc.liability.s62_item_2' as tyc_liability_s62_item_2,
	'tyc.liability.s62_item_3' as tyc_liability_s62_item_3,
	'tyc.indemnification.title' as tyc_indemnification_title,
	'tyc.indemnification.intro' as tyc_indemnification_intro,
	'tyc.indemnification.item_1' as tyc_indemnification_item_1,
	'tyc.indemnification.item_2' as tyc_indemnification_item_2,
	'tyc.indemnification.item_3' as tyc_indemnification_item_3,
	'tyc.indemnification.item_4' as tyc_indemnification_item_4,
	'tyc.privacy.title' as tyc_privacy_title,
	'tyc.privacy.p1' as tyc_privacy_p1,
	'tyc.privacy.infocard' as tyc_privacy_infocard,
	'tyc.modifications.title' as tyc_modifications_title,
	'tyc.modifications.p1' as tyc_modifications_p1,
	'tyc.law.title' as tyc_law_title,
	'tyc.law.p1' as tyc_law_p1,
	'tyc.contact.title' as tyc_contact_title,
	'tyc.contact.p1' as tyc_contact_p1,
	'tyc.contact.email_label' as tyc_contact_email_label,
	'tyc.contact.footer' as tyc_contact_footer,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_public/tyc')({
	component: TermsAndConditions,
});

// -------------------------------- CONSTANTS --------------------------------

const SECTION_IDS = [
	'acceptance', 'description', 'definitions', 'obligations',
	'ip', 'liability', 'indemnification', 'privacy',
	'modifications', 'law', 'contact',
];

// -------------------------------- HELPERS --------------------------------

function BulletItem({ text }: { text: string }) {
	return (
		<li className="flex items-start gap-2">
			<span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
			<span>{text}</span>
		</li>
	);
}

function InfoCard({ children }: { children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
			{children}
		</div>
	);
}

function CardItem({ label, desc }: { label: string; desc: string }) {
	return (
		<div className="rounded-xl border border-border bg-card p-4 space-y-1">
			<p className="font-semibold text-foreground text-sm">{label}</p>
			<p className="text-muted-foreground text-sm">{desc}</p>
		</div>
	);
}

function SubGroup({ title, intro, items }: { title: string; intro: string; items: string[] }) {
	return (
		<div className="space-y-2">
			<p className="font-semibold text-foreground">{title}</p>
			<p>{intro}</p>
			<ul className="space-y-1.5 pl-4">
				{items.map((item) => <BulletItem key={item} text={item} />)}
			</ul>
		</div>
	);
}

function Section({
	id, title, children, isLast,
}: {
	id: string;
	title: string;
	children: React.ReactNode;
	isLast?: boolean;
}) {
	return (
		<motion.div
			id={id}
			initial={{ opacity: 0, y: 24 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true }}
			transition={{ duration: 0.4, ease: 'easeOut' }}
			className="space-y-4 scroll-mt-28"
		>
			<h2 className="text-xl font-bold text-foreground">{title}</h2>
			<div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
				{children}
			</div>
			{!isLast && <div className="border-b border-foreground/5 pt-4" />}
		</motion.div>
	);
}

// -------------------------------- MAIN COMPONENT --------------------------------

export default function TermsAndConditions() {
	const navigate = useNavigate();
	const [language, setLanguage] = usePersistedLanguage();
	const [activeSection, setActiveSection] = useState('acceptance');

	const lc = { locale: language };

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) setActiveSection(entry.target.id);
				}
			},
			{ rootMargin: '-80px 0px -60% 0px' },
		);
		for (const id of SECTION_IDS) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, []);

	const tocSections = [
		{ id: 'acceptance', title: tyc_acceptance_title({}, lc) },
		{ id: 'description', title: tyc_description_title({}, lc) },
		{ id: 'definitions', title: tyc_definitions_title({}, lc) },
		{ id: 'obligations', title: tyc_obligations_title({}, lc) },
		{ id: 'ip', title: tyc_ip_title({}, lc) },
		{ id: 'liability', title: tyc_liability_title({}, lc) },
		{ id: 'indemnification', title: tyc_indemnification_title({}, lc) },
		{ id: 'privacy', title: tyc_privacy_title({}, lc) },
		{ id: 'modifications', title: tyc_modifications_title({}, lc) },
		{ id: 'law', title: tyc_law_title({}, lc) },
		{ id: 'contact', title: tyc_contact_title({}, lc) },
	];

	const navSections = [
		{ id: 'hero', label: navbar_nav_home({}, lc) },
		{ id: 'intro', label: navbar_nav_platform({}, lc) },
		{ id: 'nexy', label: navbar_nav_nexy({}, lc) },
		{ id: 'usecases', label: navbar_nav_use_cases({}, lc) },
		{ id: 'features', label: navbar_nav_features({}, lc) },
	];

	const scrollToSection = (id: string) => {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth' });
			setActiveSection(id);
		}
	};

	return (
		<div className="min-h-screen w-full bg-background text-foreground flex flex-col">
			<Navbar
				language={language}
				onLanguageChange={setLanguage}
				navSections={navSections}
				mobileMenuSections={navSections}
				onScrollToSection={() => navigate({ to: '/home' })}
				onLogoClick={() => navigate({ to: '/home' })}
				showMobileLogin
			/>

			<main className="flex-1 pt-20 pb-20">
				<div className="max-w-6xl mx-auto px-6">

					{/* Hero */}
					<motion.div
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
						className="text-center py-16 space-y-4"
					>
						<h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
							{tyc_title({}, lc)}
						</h1>
						<p className="text-muted-foreground text-lg max-w-xl mx-auto">
							{tyc_last_updated({}, lc)}
						</p>
					</motion.div>

					<div className="grid lg:grid-cols-[240px_1fr] gap-10 items-start">

						{/* Sidebar TOC */}
						<aside className="hidden lg:block lg:sticky lg:top-24 space-y-1">
							{tocSections.map((sec) => (
								<button
									key={sec.id}
									type="button"
									onClick={() => scrollToSection(sec.id)}
									className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer ${
										activeSection === sec.id
											? 'bg-primary/10 text-primary font-semibold'
											: 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
									}`}
								>
									{sec.title}
								</button>
							))}
						</aside>

						{/* Sections */}
						<div className="space-y-10">

							{/* 1. Acceptance */}
							<Section id="acceptance" title={tyc_acceptance_title({}, lc)}>
								<p>{tyc_acceptance_p1({}, lc)}</p>
							</Section>

							{/* 2. Description */}
							<Section id="description" title={tyc_description_title({}, lc)}>
								<p>{tyc_description_p1({}, lc)}</p>
								<ul className="space-y-1.5 pl-4">
									{[tyc_description_item_1, tyc_description_item_2, tyc_description_item_3, tyc_description_item_4].map((fn) => (
										<BulletItem key={fn({}, lc)} text={fn({}, lc)} />
									))}
								</ul>
								<InfoCard>{tyc_description_infocard({}, lc)}</InfoCard>
							</Section>

							{/* 3. Definitions */}
							<Section id="definitions" title={tyc_definitions_title({}, lc)}>
								<div className="grid sm:grid-cols-2 gap-3">
									{[
										{ label: tyc_definitions_user_label({}, lc), desc: tyc_definitions_user_desc({}, lc) },
										{ label: tyc_definitions_tenant_label({}, lc), desc: tyc_definitions_tenant_desc({}, lc) },
										{ label: tyc_definitions_tenant_admin_label({}, lc), desc: tyc_definitions_tenant_admin_desc({}, lc) },
										{ label: tyc_definitions_regular_user_label({}, lc), desc: tyc_definitions_regular_user_desc({}, lc) },
										{ label: tyc_definitions_connected_sources_label({}, lc), desc: tyc_definitions_connected_sources_desc({}, lc) },
										{ label: tyc_definitions_ingested_data_label({}, lc), desc: tyc_definitions_ingested_data_desc({}, lc) },
										{ label: tyc_definitions_external_data_label({}, lc), desc: tyc_definitions_external_data_desc({}, lc) },
									].map(({ label, desc }) => (
										<CardItem key={label} label={label} desc={desc} />
									))}
								</div>
							</Section>

							{/* 4. Obligations */}
							<Section id="obligations" title={tyc_obligations_title({}, lc)}>
								<SubGroup
									title={tyc_obligations_s41_title({}, lc)}
									intro={tyc_obligations_s41_intro({}, lc)}
									items={[tyc_obligations_s41_item_1, tyc_obligations_s41_item_2, tyc_obligations_s41_item_3, tyc_obligations_s41_item_4].map((fn) => fn({}, lc))}
								/>
								<SubGroup
									title={tyc_obligations_s42_title({}, lc)}
									intro={tyc_obligations_s42_intro({}, lc)}
									items={[tyc_obligations_s42_item_1, tyc_obligations_s42_item_2, tyc_obligations_s42_item_3, tyc_obligations_s42_item_4, tyc_obligations_s42_item_5].map((fn) => fn({}, lc))}
								/>
								<SubGroup
									title={tyc_obligations_s43_title({}, lc)}
									intro={tyc_obligations_s43_intro({}, lc)}
									items={[tyc_obligations_s43_item_1, tyc_obligations_s43_item_2, tyc_obligations_s43_item_3].map((fn) => fn({}, lc))}
								/>
							</Section>

							{/* 5. Intellectual Property */}
							<Section id="ip" title={tyc_ip_title({}, lc)}>
								<ul className="space-y-1.5 pl-4">
									{[tyc_ip_item_1, tyc_ip_item_2, tyc_ip_item_3].map((fn) => (
										<BulletItem key={fn({}, lc)} text={fn({}, lc)} />
									))}
								</ul>
							</Section>

							{/* 6. Liability */}
							<Section id="liability" title={tyc_liability_title({}, lc)}>
								<SubGroup
									title={tyc_liability_s61_title({}, lc)}
									intro={tyc_liability_s61_intro({}, lc)}
									items={[tyc_liability_s61_item_1, tyc_liability_s61_item_2, tyc_liability_s61_item_3, tyc_liability_s61_item_4].map((fn) => fn({}, lc))}
								/>
								<SubGroup
									title={tyc_liability_s62_title({}, lc)}
									intro={tyc_liability_s62_intro({}, lc)}
									items={[tyc_liability_s62_item_1, tyc_liability_s62_item_2, tyc_liability_s62_item_3].map((fn) => fn({}, lc))}
								/>
							</Section>

							{/* 7. Indemnification */}
							<Section id="indemnification" title={tyc_indemnification_title({}, lc)}>
								<p>{tyc_indemnification_intro({}, lc)}</p>
								<ul className="space-y-1.5 pl-4">
									{[tyc_indemnification_item_1, tyc_indemnification_item_2, tyc_indemnification_item_3, tyc_indemnification_item_4].map((fn) => (
										<BulletItem key={fn({}, lc)} text={fn({}, lc)} />
									))}
								</ul>
							</Section>

							{/* 8. Privacy */}
							<Section id="privacy" title={tyc_privacy_title({}, lc)}>
								<p>{tyc_privacy_p1({}, lc)}</p>
								<InfoCard>{tyc_privacy_infocard({}, lc)}</InfoCard>
							</Section>

							{/* 9. Modifications */}
							<Section id="modifications" title={tyc_modifications_title({}, lc)}>
								<p>{tyc_modifications_p1({}, lc)}</p>
							</Section>

							{/* 10. Governing Law */}
							<Section id="law" title={tyc_law_title({}, lc)}>
								<p>{tyc_law_p1({}, lc)}</p>
							</Section>

							{/* 11. Contact */}
							<Section id="contact" title={tyc_contact_title({}, lc)} isLast>
								<p>{tyc_contact_p1({}, lc)}</p>
								<div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
									<span className="font-semibold text-foreground text-sm">{tyc_contact_email_label({}, lc)}</span>
									<a href="mailto:legal@nexata.com" className="text-primary underline underline-offset-2 text-sm">
										legal@nexata.com
									</a>
								</div>
								<p className="text-xs text-muted-foreground">{tyc_contact_footer({}, lc)}</p>
							</Section>

						</div>
					</div>
				</div>
			</main>

			<Footer language={language} />
		</div>
	);
}
