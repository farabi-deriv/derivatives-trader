import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';

type Handler = (event: MouseEvent) => void;
export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
    ref: RefObject<T>,
    handler: Handler,
    validationFn?: (event: MouseEvent) => boolean,
    mouseEvent: 'mousedown' | 'mouseup' = 'mousedown'
): void {
    const savedHandler = useRef(handler);
    const savedValidationFn = useRef(validationFn);

    useLayoutEffect(() => {
        savedHandler.current = handler;
        savedValidationFn.current = validationFn;
    }, [handler, validationFn]);

    useEffect(() => {
        const listener = (event: Event) => {
            const el = ref?.current;
            const mouse_event = event as MouseEvent;

            // Do nothing if clicking ref's element or descendent elements
            if (!el || el.contains(mouse_event.target as Node)) {
                return;
            }

            if (savedValidationFn.current && !savedValidationFn.current(mouse_event)) return;

            savedHandler.current(mouse_event);
        };

        window.addEventListener(mouseEvent, listener);

        return () => window.removeEventListener(mouseEvent, listener);
    }, [mouseEvent, ref]);
}
