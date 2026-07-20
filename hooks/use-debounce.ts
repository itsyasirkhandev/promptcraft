import { useEffect, useState } from 'react';

/**
 * Debounce a value by `delay` ms. The returned value only updates once `value`
 * has stopped changing for the delay window. Used by the marketplace search
 * so the Convex query fires once per typing pause (300ms), not per keystroke.
 *
 * Mirrors the reference `useDebounce(value, 300)` semantics: the debounced
 * value starts equal to the initial `value` (no pending state on first render),
 * and each `value` change resets the timer.
 */
export function useDebounce<T>(value: T, delay?: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay || 500);

		return () => {
			clearTimeout(timer);
		};
	}, [value, delay]);

	return debouncedValue;
}