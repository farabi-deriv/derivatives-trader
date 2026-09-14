type TTimes = { open?: string[]; close?: string[] };

/** Formats a symbol's session times into a range like "00:00:00 - 23:59:59". */
export const formatTradingTimeRange = (times?: TTimes): string => {
    const open = times?.open?.[0];
    const close = times?.close?.[0];
    return open && close ? `${open} - ${close}` : '';
};
