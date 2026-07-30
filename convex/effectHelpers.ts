import { Effect } from "effect";
import { ConvexError, ObjectType, PropertyValidators, Value } from "convex/values";

function toConvexSafeValue(value: unknown): Value {
	if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string" || typeof value === "bigint") {
		return value;
	}
	if (value instanceof ArrayBuffer) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(toConvexSafeValue);
	}
	if (typeof value === "object") {
		const obj: Record<string, Value> = {};
		for (const [k, v] of Object.entries(value)) {
			if (v !== undefined && typeof v !== "function" && typeof v !== "symbol") {
				obj[k] = toConvexSafeValue(v);
			}
		}
		return obj;
	}
	return String(value);
}

export async function runEffect<Result, Error>(
	effect: Effect.Effect<Result, Error, never>
): Promise<Result> {
	try {
		return await Effect.runPromise(effect);
	} catch (error) {
		if (error && typeof error === 'object' && '_tag' in error) {
			// Schema.TaggedErrorClass fields (message, etc.) are defined as
			// non-enumerable own properties in Effect v4, so both object spread
			// AND JSON.stringify drop them. Use getOwnPropertyNames to capture all
			// own properties regardless of enumerability and sanitize values.
			const tag = (error as { _tag: string })._tag;
			const serialized: Record<string, Value> = {};
			for (const key of Object.getOwnPropertyNames(error)) {
				if (key !== '_tag' && key !== 'name' && key !== 'stack' && key !== 'constructor') {
					const val = (error as Record<string, unknown>)[key];
					if (val !== undefined) {
						serialized[key] = toConvexSafeValue(val);
					}
				}
			}
			throw new ConvexError({ tag, data: serialized });
		}
		throw error;
	}
}

// Build the shared handler body for an effect-backed Convex custom function
// (authedQuery / authedMutation / authedAction / privateQuery / ...). `provide`
// injects the service(s) the handler's Effect requires, narrowing the requirement
// set to `never` so the caller's `run*Effect` can execute it. Lifts the repeated
// `run(options.handler(args).pipe(provide(ctx)))` boilerplate out of every wrapper.
export function effectHandler<
	Args extends PropertyValidators,
	R,
	E,
	Req,
	Ctx,
>(
	run: (effect: Effect.Effect<R, E, never>) => Promise<R>,
	options: {
		args: Args;
		handler: (args: ObjectType<Args>) => Effect.Effect<R, E, Req>;
	},
	provide: (ctx: Ctx) => (effect: Effect.Effect<R, E, Req>) => Effect.Effect<R, E, never>,
) {
	return async (ctx: Ctx, args: ObjectType<Args>): Promise<R> =>
		run(options.handler(args).pipe(provide(ctx)));
}


