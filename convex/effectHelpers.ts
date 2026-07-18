import { Effect } from "effect";
import { ConvexError, ObjectType, PropertyValidators } from "convex/values";

export async function runEffect<Result, Error>(
	effect: Effect.Effect<Result, Error, never>
): Promise<Result> {
	try {
		return await Effect.runPromise(effect);
	} catch (error) {
		if (error && typeof error === 'object' && '_tag' in error) {
			const taggedError = error as { _tag: string; [key: string]: unknown };
			throw new ConvexError({
				tag: taggedError._tag,
				data: taggedError as unknown as Record<string, string | number | boolean | null>
			});
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
