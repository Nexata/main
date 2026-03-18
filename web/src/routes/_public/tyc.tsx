import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Navbar } from '@/components/navbar/navbar';
import { Footer } from '@/components/footer/footer';
import { LANGUAGE_OPTIONS } from '@/hooks/use-sync-language';
import type { Language } from '@/lib/user';
import {
	'navbar.nav_home' as navbar_nav_home,
	'navbar.nav_platform' as navbar_nav_platform,
	'navbar.nav_nexy' as navbar_nav_nexy,
	'navbar.nav_use_cases' as navbar_nav_use_cases,
	'navbar.nav_features' as navbar_nav_features,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_public/tyc')({
  component: TermsAndConditions,
});

// -------------------------------- TYPES --------------------------------

type Section = {
  id: string;
  title: string;
  content: React.ReactNode;
};

// -------------------------------- HELPERS --------------------------------

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
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

// -------------------------------- CONTENT --------------------------------

function getSections(language: Language): Section[] {
  const isEs = language === 'es';

  return [
    {
      id: 'acceptance',
      title: isEs ? '1. Aceptacion de los Terminos' : '1. Acceptance of Terms',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <p>
            {isEs
              ? 'Al acceder o utilizar los servicios de Nexata (en adelante, "el Servicio"), usted acepta quedar vinculado por estos Terminos y Condiciones. Si no esta de acuerdo, no utilice el Servicio.'
              : 'By accessing or using Nexata services (hereinafter, "the Service"), you agree to be bound by these Terms and Conditions. If you disagree, do not use the Service.'}
          </p>
        </div>
      ),
    },
    {
      id: 'description',
      title: isEs ? '2. Descripcion del Servicio' : '2. Service Description',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <p>
            {isEs
              ? 'Nexata es una plataforma de conocimiento empresarial que proporciona herramientas para buscar, gestionar e interactuar con datos de fuentes conectadas, incluyendo pero no limitado a:'
              : 'Nexata is an enterprise knowledge platform that provides tools to search, manage, and interact with data from connected sources, including but not limited to:'}
          </p>
          <BulletList
            items={
              isEs
                ? [
                    'Google Drive, Gmail, Google Calendar',
                    'Microsoft Outlook, OneDrive',
                    'Dropbox',
                    'Sistemas de credenciales y gestion de usuarios',
                  ]
                : [
                    'Google Drive, Gmail, Google Calendar',
                    'Microsoft Outlook, OneDrive',
                    'Dropbox',
                    'Credential systems and user management',
                  ]
            }
          />
          <InfoCard>
            {isEs
              ? 'Nexata no almacena sus datos de origen. Actua como una capa de acceso y procesamiento que respeta los permisos y configuraciones de las fuentes conectadas.'
              : 'Nexata does not store your source data. It acts as an access and processing layer that respects the permissions and configurations of connected sources.'}
          </InfoCard>
        </div>
      ),
    },
    {
      id: 'definitions',
      title: isEs ? '3. Definiciones' : '3. Definitions',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <div className="grid sm:grid-cols-2 gap-3">
            {(isEs
              ? [
                  { label: 'Usuario', desc: 'Cualquier persona que acceda o utilice el Servicio.' },
                  { label: 'Inquilino', desc: 'La organizacion o entidad para la cual el Usuario esta autorizado a usar el Servicio.' },
                  { label: 'Administrador de Inquilino', desc: 'Usuario con privilegios para gestionar configuraciones a nivel de inquilino.' },
                  { label: 'Usuario Regular', desc: 'Usuario sin privilegios de administrador.' },
                  { label: 'Fuentes Conectadas', desc: 'Servicios de terceros integrados con Nexata mediante autorizacion explicita del Usuario.' },
                  { label: 'Datos Ingestados', desc: 'Archivos subidos directamente a Nexata o sincronizados desde Fuentes Conectadas y procesados por la plataforma.' },
                  { label: 'Datos Externos', desc: 'Informacion recuperada en tiempo real de Fuentes Conectadas mediante consultas activas.' },
                ]
              : [
                  { label: 'User', desc: 'Any person who accesses or uses the Service.' },
                  { label: 'Tenant', desc: 'The organization or entity for which the User is authorized to use the Service.' },
                  { label: 'Tenant Administrator', desc: 'A User with privileges to manage tenant-level configurations.' },
                  { label: 'Regular User', desc: 'A User without administrator privileges.' },
                  { label: 'Connected Sources', desc: 'Third-party services integrated with Nexata through explicit User authorization.' },
                  { label: 'Ingested Data', desc: 'Files uploaded directly to Nexata or synced from Connected Sources and processed by the platform.' },
                  { label: 'External Data', desc: 'Information retrieved in real time from Connected Sources through active queries.' },
                ]
            ).map((item, i) => (
              <CardItem key={i} label={item.label} desc={item.desc} />
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'obligations',
      title: isEs ? '4. Obligaciones del Usuario' : '4. User Obligations',
      content: (
        <div className="space-y-5 text-muted-foreground text-sm leading-relaxed">
          <div className="space-y-2">
            <p className="font-semibold text-foreground">
              {isEs ? '4.1 Uso Autorizado' : '4.1 Authorized Use'}
            </p>
            <p>{isEs ? 'Usted puede usar el Servicio unicamente para:' : 'You may use the Service only to:'}</p>
            <BulletList
              items={
                isEs
                  ? [
                      'Acceder, buscar y recuperar datos de sus Fuentes Conectadas autorizadas.',
                      'Gestionar credenciales y permisos para esas Fuentes Conectadas.',
                      'Utilizar las herramientas provistas por Nexata segun su documentacion.',
                      'Cumplir con las politicas de su Inquilino y las leyes aplicables.',
                    ]
                  : [
                      'Access, search, and retrieve data from your authorized Connected Sources.',
                      'Manage credentials and permissions for those Connected Sources.',
                      'Use the tools provided by Nexata according to its documentation.',
                      'Comply with your Tenant policies and applicable laws.',
                    ]
              }
            />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">
              {isEs ? '4.2 Uso Prohibido' : '4.2 Prohibited Use'}
            </p>
            <p>{isEs ? 'No debe:' : 'You must not:'}</p>
            <BulletList
              items={
                isEs
                  ? [
                      'Intentar evadir, desactivar o sobrepasar las medidas de seguridad de Nexata o Fuentes Conectadas.',
                      'Utilizar el Servicio para actividades ilegales, difamatorias o que infrinjan derechos de propiedad intelectual.',
                      'Recolectar o almacenar Datos Ingestados o Externos con fines no relacionados con el Servicio autorizado.',
                      'Compartir credenciales de Fuentes Conectadas con terceros no autorizados.',
                      'Interferir con el operativo de Nexata o fuentes de otros Usuarios.',
                    ]
                  : [
                      'Attempt to evade, disable, or bypass Nexata or Connected Sources security measures.',
                      'Use the Service for illegal, defamatory activities or activities that infringe intellectual property rights.',
                      'Collect or store Ingested or External Data for purposes unrelated to the authorized Service.',
                      'Share Connected Sources credentials obtained through Nexata with unauthorized third parties.',
                      'Interfere with the operation of Nexata or other Users sources.',
                    ]
              }
            />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">
              {isEs ? '4.3 Precision de los Datos' : '4.3 Data Accuracy'}
            </p>
            <p>
              {isEs
                ? 'Nexata se esfuerza por proporcionar resultados precisos basados en el estado actual de sus Fuentes Conectadas. Sin embargo:'
                : 'Nexata strives to provide accurate results based on the current state of your Connected Sources. However:'}
            </p>
            <BulletList
              items={
                isEs
                  ? [
                      'Nexata no garantiza la precision, integridad o puntualidad de los Datos Ingestados o Externos.',
                      'Usted es responsable de verificar la idoneidad de los datos para su uso previsto.',
                      'Los retrasos o inconsistencias en Fuentes Conectadas pueden afectar el Servicio sin responsabilidad para Nexata.',
                    ]
                  : [
                      'Nexata does not guarantee the accuracy, completeness, or timeliness of Ingested or External Data.',
                      'You are responsible for verifying the suitability of data for your intended use.',
                      'Delays or inconsistencies in Connected Sources may affect the Service without liability to Nexata.',
                    ]
              }
            />
          </div>
        </div>
      ),
    },
    {
      id: 'ip',
      title: isEs ? '5. Propiedad Intelectual' : '5. Intellectual Property',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <BulletList
            items={
              isEs
                ? [
                    'Todos los derechos sobre el Servicio, incluyendo software, documentacion, interfaces y la marca "Nexata", son propiedad exclusiva de Nexata o sus licenciantes.',
                    'Se le concede una licencia limitada, revocable, no exclusiva e intransferible para usar el Servicio unicamente conforme a estos Terminos.',
                    'No debe eliminar, ocultar ni modificar avisos de propiedad intelectual incluidos en el Servicio.',
                  ]
                : [
                    'All rights to the Service, including software, documentation, interfaces, and the "Nexata" brand, are the exclusive property of Nexata or its licensors.',
                    'You are granted a limited, revocable, non-exclusive, and non-transferable license to use the Service solely in accordance with these Terms.',
                    'You must not remove, obscure, or modify any intellectual property notices included in the Service.',
                  ]
            }
          />
        </div>
      ),
    },
    {
      id: 'liability',
      title: isEs ? '6. Descargo de Responsabilidad' : '6. Disclaimer of Liability',
      content: (
        <div className="space-y-5 text-muted-foreground text-sm leading-relaxed">
          <div className="space-y-2">
            <p className="font-semibold text-foreground">
              {isEs ? '6.1 Limitacion de Responsabilidad' : '6.1 Limitation of Liability'}
            </p>
            <p>
              {isEs
                ? 'En la maxima medida permitida por la ley, Nexata no sera responsable por daños indirectos, incidentales, especiales o punitivos derivados de:'
                : 'To the maximum extent permitted by law, Nexata shall not be liable for indirect, incidental, special, or punitive damages arising from:'}
            </p>
            <BulletList
              items={
                isEs
                  ? [
                      'Perdida de ganancias, ingresos, oportunidades comerciales o buena voluntad.',
                      'Danos derivados de inexactitudes en Datos Ingestados o Externos.',
                      'Interrupciones del servicio causadas por fallos en Fuentes Conectadas fuera del control razonable de Nexata.',
                      'Reclamaciones basadas en el incumplimiento de obligaciones de seguridad provenientes de acciones de terceros.',
                    ]
                  : [
                      'Loss of profits, revenue, business opportunities, or goodwill.',
                      'Damages arising from inaccuracies in Ingested or External Data.',
                      'Service interruptions caused by failures in Connected Sources beyond Nexatas reasonable control.',
                      'Claims based on breach of security obligations arising from third-party actions.',
                    ]
              }
            />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">
              {isEs ? '6.2 Exclusiones' : '6.2 Exclusions'}
            </p>
            <p>
              {isEs
                ? 'Nada en estos Terminos excluira ni limitara la responsabilidad de Nexata por:'
                : 'Nothing in these Terms will exclude or limit Nexata liability for:'}
            </p>
            <BulletList
              items={
                isEs
                  ? [
                      'Muerte o dano personal causado por negligencia grave.',
                      'Fraude o tergiversacion dolosa.',
                      'Responsabilidad que no pueda excluirse ni limitarse por ley aplicable.',
                    ]
                  : [
                      'Death or personal injury caused by gross negligence.',
                      'Fraud or willful misrepresentation.',
                      'Liability that cannot be excluded or limited by applicable law.',
                    ]
              }
            />
          </div>
        </div>
      ),
    },
    {
      id: 'indemnification',
      title: isEs ? '7. Indemnizacion' : '7. Indemnification',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <p>
            {isEs
              ? 'Usted acepta indemnizar, defender y mantener indemne a Nexata, sus funcionarios, directores y agentes de y contra cualquier reclamacion, perdida, responsabilidad o dano que surjan de:'
              : 'You agree to indemnify, defend, and hold harmless Nexata, its officers, directors, and agents from and against any claims, losses, liabilities, or damages arising from:'}
          </p>
          <BulletList
            items={
              isEs
                ? [
                    'Su incumplimiento de estos Terminos.',
                    'Su violacion de cualquier ley aplicable o los derechos de un tercero.',
                    'Su uso no autorizado o inadecuado del Servicio.',
                    'Alegaciones de que su uso del Servicio provoco una infraccion de derechos de propiedad intelectual de terceros.',
                  ]
                : [
                    'Your breach of these Terms.',
                    'Your violation of any applicable law or third-party rights.',
                    'Your unauthorized or improper use of the Service.',
                    'Allegations that your use of the Service caused an infringement of third-party intellectual property rights.',
                  ]
            }
          />
        </div>
      ),
    },
    {
      id: 'privacy',
      title: isEs ? '8. Privacidad y Proteccion de Datos' : '8. Privacy and Data Protection',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <p>
            {isEs
              ? 'Nexata procesa datos personales unicamente segun lo necesario para proporcionar el Servicio y conforme a su Politica de Privacidad. Las Fuentes Conectadas pueden tener sus propias practicas de privacidad; se le recomienda revisarlas.'
              : 'Nexata processes personal data only as necessary to provide the Service and in accordance with its Privacy Policy. Connected Sources may have their own privacy practices; you are encouraged to review them.'}
          </p>
          <InfoCard>
            {isEs
              ? 'Nexata no es responsable de las practicas de privacidad o el manejo de datos de Fuentes Conectadas.'
              : 'Nexata is not responsible for the privacy practices or data handling of Connected Sources.'}
          </InfoCard>
        </div>
      ),
    },
    {
      id: 'modifications',
      title: isEs ? '9. Modificaciones a estos Terminos' : '9. Modifications to These Terms',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <p>
            {isEs
              ? 'Nexata se reserva el derecho de modificar o reemplazar estos Terminos en cualquier momento. Los cambios seran efectivos tras su publicacion. El uso continuado del Servicio despues de dichas modificaciones constituye la aceptacion de los Terminos revisados.'
              : 'Nexata reserves the right to modify or replace these Terms at any time. Changes will be effective upon publication. Continued use of the Service after such modifications constitutes acceptance of the revised Terms.'}
          </p>
        </div>
      ),
    },
    {
      id: 'law',
      title: isEs ? '10. Ley Aplicable y Jurisdiccion' : '10. Governing Law and Jurisdiction',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <p>
            {isEs
              ? 'Estos Terminos se rigen e interpretaran conforme a las leyes de los Estados Unidos de America. Cualquier disputa legal se sometera exclusivamente a los tribunales estatales o federales ubicados en el Condado de Santa Clara, California.'
              : 'These Terms are governed by and construed in accordance with the laws of the United States of America. Any legal dispute shall be submitted exclusively to the state or federal courts located in Santa Clara County, California.'}
          </p>
        </div>
      ),
    },
    {
      id: 'contact',
      title: isEs ? '11. Contacto' : '11. Contact',
      content: (
        <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
          <p>{isEs ? 'Para preguntas sobre estos Terminos, contactenos en:' : 'For questions about these Terms, contact us at:'}</p>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <span className="font-semibold text-foreground text-sm">{isEs ? 'Correo Legal' : 'Legal Email'}</span>
            <a href="mailto:legal@nexata.com" className="text-primary underline underline-offset-2 text-sm">
              legal@nexata.com
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? 'Fecha de entrada en vigor: 16 de marzo de 2026. Este documento se proporciona en espanol e ingles. En caso de discrepancia, prevalecera la version en ingles.'
              : 'Effective date: March 16, 2026. This document is provided in Spanish and English. In case of discrepancy, the English version shall prevail.'}
          </p>
        </div>
      ),
    },
  ];
}

// -------------------------------- MAIN COMPONENT --------------------------------

export default function TermsAndConditions() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>(LANGUAGE_OPTIONS[0].value);
  const [activeSection, setActiveSection] = useState('acceptance');

  const sections = getSections(language);

  useEffect(() => {
    const sectionIds = getSections(language).map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [language]);

  const locale = { locale: language };
  const navSections = [
    { id: 'hero', label: navbar_nav_home({}, locale) },
    { id: 'intro', label: navbar_nav_platform({}, locale) },
    { id: 'nexy', label: navbar_nav_nexy({}, locale) },
    { id: 'usecases', label: navbar_nav_use_cases({}, locale) },
    { id: 'features', label: navbar_nav_features({}, locale) },
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

      {/* Navbar */}
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
              {language === 'es' ? 'Terminos y Condiciones' : 'Terms and Conditions'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {language === 'es'
                ? 'Ultima actualizacion: 16 de marzo de 2026'
                : 'Last updated: March 16, 2026'}
            </p>
          </motion.div>

          {/* Layout: sidebar + content */}
          <div className="grid lg:grid-cols-[240px_1fr] gap-10 items-start">

            {/* Sidebar TOC */}
            <aside className="hidden lg:block lg:sticky lg:top-24 space-y-1">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer
                    ${activeSection === sec.id
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
              {sections.map((sec, i) => (
                <motion.div
                  key={sec.id}
                  id={sec.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.03, ease: 'easeOut' }}
                  className="space-y-4 scroll-mt-28"
                >
                  <h2 className="text-xl font-bold text-foreground">{sec.title}</h2>
                  <div>{sec.content}</div>
                  {i < sections.length - 1 && (
                    <div className="border-b border-foreground/5 pt-4" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer language={language} />

    </div>
  );
}
