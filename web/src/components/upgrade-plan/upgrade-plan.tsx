import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Check, Mail, Star, Briefcase } from "lucide-react";

type UpgradePlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UpgradePlanModal({ open, onOpenChange }: UpgradePlanModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] sm:w-[85vw] lg:w-[70vw]
          max-w-[95vw] sm:max-w-[85vw] lg:max-w-[70vw]
          max-h-[90vh]
          overflow-y-auto
          px-6 sm:px-8
          py-8 sm:py-10
        "
      >
        <DialogHeader>
          <h2 className="text-lg font-semibold tracking-tight">
            Elegí el plan ideal para tu equipo
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Podés cambiar o escalar tu plan en cualquier momento.
          </p>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Personal Plan */}
          <PlanCard
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10">
                <Star className="h-4 w-4 text-sky-600" />
              </span>
            }
            title="Personal"
            price="$20 / mes"
            description="Ideal para uso individual o pruebas."
            features={[
              "100 mensajes por mes",
              "5 GB de almacenamiento",
              "5 GB de embeddings / mes",
            ]}
            action={
              <Button variant="outline" className="w-full cursor-pointer">
                Plan actual
              </Button>
            }
          />

          {/* Business Plan (destacado) */}
          <PlanCard
            highlighted
            icon={<Briefcase className="h-5 w-5 text-primary" />}
            title="Business"
            price="$200 / mes"
            description="Pensado para equipos y uso intensivo."
            features={[
              "1500 mensajes por mes",
              "30 GB de almacenamiento",
              "30 GB de embeddings / mes",
            ]}
            action={
              <Button className="w-full cursor-pointer">
                Actualizar a Business
              </Button>
            }
          />

          {/* Custom Plan */}
          <PlanCard
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10">
                <Mail className="h-4 w-4 text-violet-600" />
              </span>
            }
            title="Plan personalizado"
            price="A medida"
            description="Soluciones avanzadas para necesidades específicas."
            features={[
              "Planes totalmente personalizados",
              "Integraciones con proveedores externos",
              "Conexión a fuentes de datos propias",
            ]}
            action={
              <Button
                variant="outline"
                className="
                  w-full cursor-pointer
                  border-violet-500/40
                  hover:bg-violet-500/10
                  hover:border-violet-500
                  focus-visible:ring-violet-500/30
                "
              >
                Contactanos
              </Button>
            }
          />

        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Plan Card                                    */
/* -------------------------------------------------------------------------- */

function PlanCard({
  icon,
  title,
  price,
  description,
  features,
  action,
  highlighted = false,
}: {
  icon: React.ReactNode;
  title: string;
  price: string;
  description: string;
  features: string[];
  action: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`
        relative flex flex-col justify-between rounded-xl border p-5 transition-colors
        ${
          highlighted
            ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
            : "border-border bg-muted/40 hover:bg-muted/50"
        }
      `}
    >
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-medium">{title}</h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <p className="mt-3 text-2xl font-semibold tracking-tight">
          {price}
        </p>

        <ul className="mt-4 space-y-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Check className="h-4 w-4 text-primary shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">{action}</div>
    </div>
  );
}
