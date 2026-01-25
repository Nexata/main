import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Package, Zap } from "lucide-react";
import {
  'components.buy_messages_modal.title' as components_buy_messages_modal_title,
  'components.buy_messages_modal.subtitle' as components_buy_messages_modal_subtitle,
  'components.buy_messages_modal.info.line_1' as components_buy_messages_modal_info_line_1,
  'components.buy_messages_modal.info.line_2' as components_buy_messages_modal_info_line_2,
  'components.buy_messages_modal.custom.title' as components_buy_messages_modal_custom_title,
  'components.buy_messages_modal.custom.input_label' as components_buy_messages_modal_custom_input_label,
  'components.buy_messages_modal.custom.input_placeholder' as components_buy_messages_modal_custom_input_placeholder,
  'components.buy_messages_modal.custom.price_per_message' as components_buy_messages_modal_custom_price_per_message,
  'components.buy_messages_modal.custom.helper' as components_buy_messages_modal_custom_helper,
  'components.buy_messages_modal.custom.buy_button' as components_buy_messages_modal_custom_buy_button
} from '@/paraglide/messages.js';
import { useMemo, useState } from "react";


type BuyMessagesModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function BuyMessagesModal({ open, onOpenChange }: BuyMessagesModalProps) {
    const PRICE_PER_MESSAGE = 0.13;
    const [customAmount, setCustomAmount] = useState<string>("");

    const totalPrice = useMemo(() => {
        const qty = Number(customAmount);
        if (!qty || qty <= 0) return null;
        return qty * PRICE_PER_MESSAGE;
    }, [customAmount]);


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
            className="
            w-[95vw] sm:w-[80vw] lg:w-[60vw]
            min-w-[95vw] sm:min-w-[80vw] lg:min-w-[60vw]
            max-w-[95vw] sm:max-w-[80vw] lg:max-w-[60vw]
            max-h-[90vh]
            overflow-y-auto
            px-6 sm:px-8
            py-8 sm:py-10
            "
            >
                <DialogHeader className="space-y-0">
                    <div>
                        <h2 className="text-lg font-semibold">{components_buy_messages_modal_title()}</h2>
                        <p className="mt-1.5 text-sm text-muted-foreground">{components_buy_messages_modal_subtitle()}</p>
                    </div>
                </DialogHeader>

                <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed">
                    <p>{components_buy_messages_modal_info_line_1()}</p>
                    <p className="mt-2 text-muted-foreground">{components_buy_messages_modal_info_line_2()}</p>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {/* Pack 100 */}
                    <div className="rounded-xl border border-border bg-muted/40 p-4 hover:bg-muted/50 transition-colors flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Pack 100</p>
                                <p className="text-sm text-muted-foreground">
                                $0.12 por mensaje
                                </p>
                            </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between">
                            <p className="font-semibold">$12.00</p>
                            <Button size="sm" className="cursor-pointer">{components_buy_messages_modal_custom_buy_button()}</Button>
                        </div>
                    </div>

                    {/* Pack 500 (destacado) */}
                    <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 ring-1 ring-primary/20 flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium">Pack 500</p>
                                <p className="text-sm text-muted-foreground">
                                $0.09 por mensaje
                                </p>
                            </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between">
                            <p className="font-semibold">$45.00</p>
                            <Button size="sm" className="cursor-pointer" variant="default">
                                {components_buy_messages_modal_custom_buy_button()}
                            </Button>
                        </div>
                    </div>

                    {/* Pack 1500 */}
                    <div className="rounded-xl border border-border bg-muted/40 p-4 hover:bg-muted/50 transition-colors flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Pack 1500</p>
                                <p className="text-sm text-muted-foreground">
                                $0.06 por mensaje
                                </p>
                            </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between">
                            <p className="font-semibold">$90.00</p>
                            <Button size="sm" className="cursor-pointer">{components_buy_messages_modal_custom_buy_button()}</Button>
                        </div>
                    </div>
                </div>

                <Separator className="my-3" />

                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                    <p className="text-sm font-medium">{components_buy_messages_modal_custom_title()}</p>

                    <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full">
                        <div className="w-full sm:max-w-[220px]">
                            <label className="text-xs text-muted-foreground">{components_buy_messages_modal_custom_input_label()}</label>
                            <Input
                            type="number"
                            min={1}
                            placeholder={components_buy_messages_modal_custom_input_placeholder()}
                            className="h-9"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-row items-center gap-4 flex-1">
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium">
                                ${PRICE_PER_MESSAGE}{components_buy_messages_modal_custom_price_per_message()}
                                </span>

                                <span className="h-3 w-px bg-border" />

                                <span className="font-semibold text-foreground">
                                    Total:{" "}
                                    {totalPrice !== null ? `$${totalPrice.toFixed(2)}` : "-"}
                                </span>
                            </span>

                            <Button className="h-9 cursor-pointer ml-auto">
                                <CreditCard className="h-4 w-4 mr-2" />
                                {components_buy_messages_modal_custom_buy_button()}
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">{components_buy_messages_modal_custom_helper()}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
