import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CurrencyState = {
	showARS: boolean;
	setShowARS: (v: boolean) => void;
	toggleCurrency: () => void;
};

export const useCurrencyStore = create<CurrencyState>()(
	persist(
		(set) => ({
			showARS: false,
			setShowARS: (v) => set({ showARS: v }),
			toggleCurrency: () => set((s) => ({ showARS: !s.showARS })),
		}),
		{
			name: 'currency-store',
			partialize: (state) => ({ showARS: state.showARS }),
		},
	),
);

/**
 * Format a USD amount according to the current currency preference.
 * When `showARS` is true and a quote is available the value is converted to ARS.
 */
export function formatAmount(
	usd: number,
	showARS: boolean,
	quote: number | null,
) {
	if (showARS && quote)
		return (
			'$' + (usd * quote).toLocaleString('es-AR', { maximumFractionDigits: 0 })
		);
	return (
		'USD ' +
		usd.toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
	);
}

/**
 * Like `formatAmount` but keeps up to 2 decimal places for unit prices.
 */
export function formatAmountUnit(
	usd: number,
	showARS: boolean,
	quote: number | null,
) {
	if (showARS && quote)
		return (
			'$' + (usd * quote).toLocaleString('es-AR', { maximumFractionDigits: 2 })
		);
	return (
		'USD ' +
		usd.toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 4,
		})
	);
}
