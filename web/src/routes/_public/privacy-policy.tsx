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
	'privacy_policy.title' as pp_title,
	'privacy_policy.last_updated' as pp_last_updated,
	'privacy_policy.intro.title' as pp_intro_title,
	'privacy_policy.intro.p1_a' as pp_intro_p1_a,
	'privacy_policy.intro.p1_b' as pp_intro_p1_b,
	'privacy_policy.intro.p2' as pp_intro_p2,
	'privacy_policy.intro.p3' as pp_intro_p3,
	'privacy_policy.intro.notice_label' as pp_intro_notice_label,
	'privacy_policy.intro.notice_text' as pp_intro_notice_text,
	'privacy_policy.scope.title' as pp_scope_title,
	'privacy_policy.scope.applies_to' as pp_scope_applies_to,
	'privacy_policy.scope.item_1' as pp_scope_item_1,
	'privacy_policy.scope.item_2' as pp_scope_item_2,
	'privacy_policy.scope.item_3' as pp_scope_item_3,
	'privacy_policy.scope.item_4' as pp_scope_item_4,
	'privacy_policy.scope.item_5' as pp_scope_item_5,
	'privacy_policy.scope.not_applies_to' as pp_scope_not_applies_to,
	'privacy_policy.scope.not_item_1' as pp_scope_not_item_1,
	'privacy_policy.scope.not_item_2' as pp_scope_not_item_2,
	'privacy_policy.data_collected.title' as pp_data_title,
	'privacy_policy.data_collected.s31_title' as pp_data_s31_title,
	'privacy_policy.data_collected.s31_item_1' as pp_data_s31_item_1,
	'privacy_policy.data_collected.s31_item_2' as pp_data_s31_item_2,
	'privacy_policy.data_collected.s31_item_3' as pp_data_s31_item_3,
	'privacy_policy.data_collected.s31_item_4' as pp_data_s31_item_4,
	'privacy_policy.data_collected.s31_item_5' as pp_data_s31_item_5,
	'privacy_policy.data_collected.s32_title' as pp_data_s32_title,
	'privacy_policy.data_collected.s32_item_1' as pp_data_s32_item_1,
	'privacy_policy.data_collected.s32_item_2' as pp_data_s32_item_2,
	'privacy_policy.data_collected.s32_item_3' as pp_data_s32_item_3,
	'privacy_policy.data_collected.s32_item_4' as pp_data_s32_item_4,
	'privacy_policy.data_collected.s32_item_5' as pp_data_s32_item_5,
	'privacy_policy.data_collected.s33_title' as pp_data_s33_title,
	'privacy_policy.data_collected.s33_item_1' as pp_data_s33_item_1,
	'privacy_policy.data_collected.s33_item_2' as pp_data_s33_item_2,
	'privacy_policy.data_collected.s33_item_3' as pp_data_s33_item_3,
	'privacy_policy.data_collected.s33_item_4' as pp_data_s33_item_4,
	'privacy_policy.usage.title' as pp_usage_title,
	'privacy_policy.usage.s41_title' as pp_usage_s41_title,
	'privacy_policy.usage.s41_item_1' as pp_usage_s41_item_1,
	'privacy_policy.usage.s41_item_2' as pp_usage_s41_item_2,
	'privacy_policy.usage.s41_item_3' as pp_usage_s41_item_3,
	'privacy_policy.usage.s41_item_4' as pp_usage_s41_item_4,
	'privacy_policy.usage.s41_item_5' as pp_usage_s41_item_5,
	'privacy_policy.usage.s42_title' as pp_usage_s42_title,
	'privacy_policy.usage.s42_item_1' as pp_usage_s42_item_1,
	'privacy_policy.usage.s42_item_2' as pp_usage_s42_item_2,
	'privacy_policy.usage.s42_item_3' as pp_usage_s42_item_3,
	'privacy_policy.usage.s42_item_4' as pp_usage_s42_item_4,
	'privacy_policy.usage.never_label' as pp_usage_never_label,
	'privacy_policy.usage.never_item_1' as pp_usage_never_item_1,
	'privacy_policy.usage.never_item_2' as pp_usage_never_item_2,
	'privacy_policy.usage.never_item_3' as pp_usage_never_item_3,
	'privacy_policy.usage.never_item_4' as pp_usage_never_item_4,
	'privacy_policy.sharing.title' as pp_sharing_title,
	'privacy_policy.sharing.intro' as pp_sharing_intro,
	'privacy_policy.sharing.provider_label' as pp_sharing_provider_label,
	'privacy_policy.sharing.provider_desc' as pp_sharing_provider_desc,
	'privacy_policy.sharing.connected_label' as pp_sharing_connected_label,
	'privacy_policy.sharing.connected_desc' as pp_sharing_connected_desc,
	'privacy_policy.sharing.legal_label' as pp_sharing_legal_label,
	'privacy_policy.sharing.legal_desc' as pp_sharing_legal_desc,
	'privacy_policy.sharing.never_label' as pp_sharing_never_label,
	'privacy_policy.sharing.never_text' as pp_sharing_never_text,
	'privacy_policy.retention.title' as pp_retention_title,
	'privacy_policy.retention.account_label' as pp_retention_account_label,
	'privacy_policy.retention.account_desc' as pp_retention_account_desc,
	'privacy_policy.retention.content_label' as pp_retention_content_label,
	'privacy_policy.retention.content_desc' as pp_retention_content_desc,
	'privacy_policy.retention.logs_label' as pp_retention_logs_label,
	'privacy_policy.retention.logs_desc' as pp_retention_logs_desc,
	'privacy_policy.retention.history_label' as pp_retention_history_label,
	'privacy_policy.retention.history_desc' as pp_retention_history_desc,
	'privacy_policy.rights.title' as pp_rights_title,
	'privacy_policy.rights.intro' as pp_rights_intro,
	'privacy_policy.rights.access_label' as pp_rights_access_label,
	'privacy_policy.rights.access_desc' as pp_rights_access_desc,
	'privacy_policy.rights.rectification_label' as pp_rights_rectification_label,
	'privacy_policy.rights.rectification_desc' as pp_rights_rectification_desc,
	'privacy_policy.rights.erasure_label' as pp_rights_erasure_label,
	'privacy_policy.rights.erasure_desc' as pp_rights_erasure_desc,
	'privacy_policy.rights.portability_label' as pp_rights_portability_label,
	'privacy_policy.rights.portability_desc' as pp_rights_portability_desc,
	'privacy_policy.rights.objection_label' as pp_rights_objection_label,
	'privacy_policy.rights.objection_desc' as pp_rights_objection_desc,
	'privacy_policy.rights.restriction_label' as pp_rights_restriction_label,
	'privacy_policy.rights.restriction_desc' as pp_rights_restriction_desc,
	'privacy_policy.rights.contact' as pp_rights_contact,
	'privacy_policy.security.title' as pp_security_title,
	'privacy_policy.security.rest_label' as pp_security_rest_label,
	'privacy_policy.security.rest_desc' as pp_security_rest_desc,
	'privacy_policy.security.transit_label' as pp_security_transit_label,
	'privacy_policy.security.transit_desc' as pp_security_transit_desc,
	'privacy_policy.security.access_label' as pp_security_access_label,
	'privacy_policy.security.access_desc' as pp_security_access_desc,
	'privacy_policy.security.monitoring_label' as pp_security_monitoring_label,
	'privacy_policy.security.monitoring_desc' as pp_security_monitoring_desc,
	'privacy_policy.children.title' as pp_children_title,
	'privacy_policy.children.p1' as pp_children_p1,
	'privacy_policy.children.p2' as pp_children_p2,
	'privacy_policy.changes.title' as pp_changes_title,
	'privacy_policy.changes.intro' as pp_changes_intro,
	'privacy_policy.changes.item_1' as pp_changes_item_1,
	'privacy_policy.changes.item_2' as pp_changes_item_2,
	'privacy_policy.changes.item_3' as pp_changes_item_3,
	'privacy_policy.changes.item_4' as pp_changes_item_4,
	'privacy_policy.contact.title' as pp_contact_title,
	'privacy_policy.contact.email_label' as pp_contact_email_label,
	'privacy_policy.contact.legal_name_label' as pp_contact_legal_name_label,
	'privacy_policy.contact.legal_name_value' as pp_contact_legal_name_value,
	'privacy_policy.contact.representative_label' as pp_contact_representative_label,
	'privacy_policy.contact.representative_value' as pp_contact_representative_value,
	'privacy_policy.contact.languages_label' as pp_contact_languages_label,
	'privacy_policy.contact.languages_value' as pp_contact_languages_value,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_public/privacy-policy')({
	component: PrivacyPolicy,
});

// -------------------------------- CONSTANTS --------------------------------

const SECTION_IDS = [
	'intro', 'scope', 'data-collected', 'usage', 'sharing',
	'retention', 'rights', 'security', 'children', 'changes', 'contact',
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

function GrayBulletItem({ text }: { text: string }) {
	return (
		<li className="flex items-start gap-2">
			<span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
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

function LabelCard({ label, desc }: { label: string; desc: string }) {
	return (
		<div className="rounded-xl border border-border bg-card p-4 space-y-1">
			<p className="font-semibold text-foreground">{label}</p>
			<p className="text-muted-foreground text-sm">{desc}</p>
		</div>
	);
}

function SubGroup({ title, items }: { title: string; items: string[] }) {
	return (
		<div className="space-y-2">
			<p className="font-semibold text-foreground">{title}</p>
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

export default function PrivacyPolicy() {
	const navigate = useNavigate();
	const [language, setLanguage] = usePersistedLanguage();
	const [activeSection, setActiveSection] = useState('intro');

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
		{ id: 'intro', title: pp_intro_title({}, lc) },
		{ id: 'scope', title: pp_scope_title({}, lc) },
		{ id: 'data-collected', title: pp_data_title({}, lc) },
		{ id: 'usage', title: pp_usage_title({}, lc) },
		{ id: 'sharing', title: pp_sharing_title({}, lc) },
		{ id: 'retention', title: pp_retention_title({}, lc) },
		{ id: 'rights', title: pp_rights_title({}, lc) },
		{ id: 'security', title: pp_security_title({}, lc) },
		{ id: 'children', title: pp_children_title({}, lc) },
		{ id: 'changes', title: pp_changes_title({}, lc) },
		{ id: 'contact', title: pp_contact_title({}, lc) },
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
							{pp_title({}, lc)}
						</h1>
						<p className="text-muted-foreground text-lg max-w-xl mx-auto">
							{pp_last_updated({}, lc)}
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

						{/* Content */}
						<div className="space-y-10">

							{/* 1. Intro */}
							<Section id="intro" title={pp_intro_title({}, lc)}>
								<p>
									{pp_intro_p1_a({}, lc)}{' '}
									<strong className="text-foreground">Nexata</strong>{' '}
									{pp_intro_p1_b({}, lc)}
								</p>
								<p>{pp_intro_p2({}, lc)}</p>
								<p>{pp_intro_p3({}, lc)}</p>
								<InfoCard>
									<strong>{pp_intro_notice_label({}, lc)}:</strong>{' '}
									{pp_intro_notice_text({}, lc)}
								</InfoCard>
							</Section>

							{/* 2. Scope */}
							<Section id="scope" title={pp_scope_title({}, lc)}>
								<p>{pp_scope_applies_to({}, lc)}</p>
								<ul className="space-y-1.5 pl-4">
									{[pp_scope_item_1, pp_scope_item_2, pp_scope_item_3, pp_scope_item_4, pp_scope_item_5].map((fn) => (
										<BulletItem key={fn({}, lc)} text={fn({}, lc)} />
									))}
								</ul>
								<p>{pp_scope_not_applies_to({}, lc)}</p>
								<ul className="space-y-1.5 pl-4">
									{[pp_scope_not_item_1, pp_scope_not_item_2].map((fn) => (
										<GrayBulletItem key={fn({}, lc)} text={fn({}, lc)} />
									))}
								</ul>
							</Section>

							{/* 3. Data Collected */}
							<Section id="data-collected" title={pp_data_title({}, lc)}>
								<div className="space-y-6">
									<SubGroup
										title={pp_data_s31_title({}, lc)}
										items={[pp_data_s31_item_1, pp_data_s31_item_2, pp_data_s31_item_3, pp_data_s31_item_4, pp_data_s31_item_5].map((fn) => fn({}, lc))}
									/>
									<SubGroup
										title={pp_data_s32_title({}, lc)}
										items={[pp_data_s32_item_1, pp_data_s32_item_2, pp_data_s32_item_3, pp_data_s32_item_4, pp_data_s32_item_5].map((fn) => fn({}, lc))}
									/>
									<SubGroup
										title={pp_data_s33_title({}, lc)}
										items={[pp_data_s33_item_1, pp_data_s33_item_2, pp_data_s33_item_3, pp_data_s33_item_4].map((fn) => fn({}, lc))}
									/>
								</div>
							</Section>

							{/* 4. Usage */}
							<Section id="usage" title={pp_usage_title({}, lc)}>
								<div className="space-y-6">
									<SubGroup
										title={pp_usage_s41_title({}, lc)}
										items={[pp_usage_s41_item_1, pp_usage_s41_item_2, pp_usage_s41_item_3, pp_usage_s41_item_4, pp_usage_s41_item_5].map((fn) => fn({}, lc))}
									/>
									<SubGroup
										title={pp_usage_s42_title({}, lc)}
										items={[pp_usage_s42_item_1, pp_usage_s42_item_2, pp_usage_s42_item_3, pp_usage_s42_item_4].map((fn) => fn({}, lc))}
									/>
									<div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5">
										<p className="font-semibold text-foreground text-sm">{pp_usage_never_label({}, lc)}</p>
										<ul className="space-y-1.5 pl-4">
											{[pp_usage_never_item_1, pp_usage_never_item_2, pp_usage_never_item_3, pp_usage_never_item_4].map((fn) => (
												<GrayBulletItem key={fn({}, lc)} text={fn({}, lc)} />
											))}
										</ul>
									</div>
								</div>
							</Section>

							{/* 5. Sharing */}
							<Section id="sharing" title={pp_sharing_title({}, lc)}>
								<p>{pp_sharing_intro({}, lc)}</p>
								<div className="space-y-3">
									<LabelCard label={pp_sharing_provider_label({}, lc)} desc={pp_sharing_provider_desc({}, lc)} />
									<LabelCard label={pp_sharing_connected_label({}, lc)} desc={pp_sharing_connected_desc({}, lc)} />
									<LabelCard label={pp_sharing_legal_label({}, lc)} desc={pp_sharing_legal_desc({}, lc)} />
								</div>
								<InfoCard>
									<strong>{pp_sharing_never_label({}, lc)}:</strong>{' '}
									{pp_sharing_never_text({}, lc)}
								</InfoCard>
							</Section>

							{/* 6. Retention */}
							<Section id="retention" title={pp_retention_title({}, lc)}>
								<div className="space-y-3">
									<LabelCard label={pp_retention_account_label({}, lc)} desc={pp_retention_account_desc({}, lc)} />
									<LabelCard label={pp_retention_content_label({}, lc)} desc={pp_retention_content_desc({}, lc)} />
									<LabelCard label={pp_retention_logs_label({}, lc)} desc={pp_retention_logs_desc({}, lc)} />
									<LabelCard label={pp_retention_history_label({}, lc)} desc={pp_retention_history_desc({}, lc)} />
								</div>
							</Section>

							{/* 7. Rights */}
							<Section id="rights" title={pp_rights_title({}, lc)}>
								<p>{pp_rights_intro({}, lc)}</p>
								<div className="grid sm:grid-cols-2 gap-3">
									{[
									{ label: pp_rights_access_label({}, lc), desc: pp_rights_access_desc({}, lc) },
									{ label: pp_rights_rectification_label({}, lc), desc: pp_rights_rectification_desc({}, lc) },
									{ label: pp_rights_erasure_label({}, lc), desc: pp_rights_erasure_desc({}, lc) },
									{ label: pp_rights_portability_label({}, lc), desc: pp_rights_portability_desc({}, lc) },
									{ label: pp_rights_objection_label({}, lc), desc: pp_rights_objection_desc({}, lc) },
									{ label: pp_rights_restriction_label({}, lc), desc: pp_rights_restriction_desc({}, lc) },
								].map(({ label, desc }) => (
									<div key={label} className="rounded-xl border border-border bg-card p-4 space-y-1">
										<p className="font-semibold text-foreground text-sm">{label}</p>
										<p className="text-xs text-muted-foreground">{desc}</p>
										</div>
									))}
								</div>
								<p>
									{pp_rights_contact({}, lc)}{' '}
									<a href="mailto:privacy@nexata.app" className="text-primary underline underline-offset-2">
										privacy@nexata.app
									</a>
								</p>
							</Section>

							{/* 8. Security */}
							<Section id="security" title={pp_security_title({}, lc)}>
								<div className="space-y-3">
									<LabelCard label={pp_security_rest_label({}, lc)} desc={pp_security_rest_desc({}, lc)} />
									<LabelCard label={pp_security_transit_label({}, lc)} desc={pp_security_transit_desc({}, lc)} />
									<LabelCard label={pp_security_access_label({}, lc)} desc={pp_security_access_desc({}, lc)} />
									<LabelCard label={pp_security_monitoring_label({}, lc)} desc={pp_security_monitoring_desc({}, lc)} />
								</div>
							</Section>

							{/* 9. Children */}
							<Section id="children" title={pp_children_title({}, lc)}>
								<p>{pp_children_p1({}, lc)}</p>
								<p>{pp_children_p2({}, lc)}</p>
							</Section>

							{/* 10. Changes */}
							<Section id="changes" title={pp_changes_title({}, lc)}>
								<p>{pp_changes_intro({}, lc)}</p>
								<ul className="space-y-1.5 pl-4">
									{[pp_changes_item_1, pp_changes_item_2, pp_changes_item_3, pp_changes_item_4].map((fn) => (
										<BulletItem key={fn({}, lc)} text={fn({}, lc)} />
									))}
								</ul>
							</Section>

							{/* 11. Contact */}
							<Section id="contact" title={pp_contact_title({}, lc)} isLast>
								<div className="space-y-3">
									<div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
										<span className="font-semibold text-foreground shrink-0 text-sm">{pp_contact_email_label({}, lc)}</span>
										<a href="mailto:privacy@nexata.app" className="text-primary underline underline-offset-2 text-right text-sm">
											privacy@nexata.app
										</a>
									</div>
									{[
									{ label: pp_contact_legal_name_label({}, lc), value: pp_contact_legal_name_value({}, lc) },
									{ label: pp_contact_representative_label({}, lc), value: pp_contact_representative_value({}, lc) },
									{ label: pp_contact_languages_label({}, lc), value: pp_contact_languages_value({}, lc) },
								].map(({ label, value }) => (
									<div key={label} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
										<span className="font-semibold text-foreground shrink-0 text-sm">{label}</span>
										<span className="text-right text-sm text-muted-foreground">{value}</span>
										</div>
									))}
								</div>
							</Section>

						</div>
					</div>
				</div>
			</main>

			<Footer language={language} />
		</div>
	);
}
