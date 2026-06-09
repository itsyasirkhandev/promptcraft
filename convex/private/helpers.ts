// "private" queries/mutations/actions are ones that get called from the backend, not the client
// they're all protected by the CONVEX_PRIVATE_BRIDGE_KEY

import { v } from 'convex/values';
import {
	customAction,
	customCtxAndArgs,
	customMutation,
	customQuery
} from 'convex-helpers/server/customFunctions';
import { action, mutation, query } from '../_generated/server';
import { ConvexError, ObjectType, PropertyValidators } from 'convex/values';
import { Effect } from 'effect';
import { ConvexDB } from '../services/ConvexDB';

const apiKeyGuard = customCtxAndArgs({
	args: { apiKey: v.string() },
	input: async (ctx, { apiKey }) => {
		if (apiKey !== process.env.CONVEX_PRIVATE_BRIDGE_KEY) {
			throw new Error('Invalid API key');
		}
		return { ctx, args: {} };
	}
});

export const privateQuery = customQuery(query, apiKeyGuard);
export const privateMutation = customMutation(mutation, apiKeyGuard);
export const privateAction = customAction(action, apiKeyGuard);

export async function runPrivateEffect<Result, Error>(
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

export const effectPrivateQuery = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, ConvexDB>;
}) => {
	return privateQuery({
		args: options.args,
		// @ts-expect-error - Convex customQuery generic wrapper TS mismatch
		handler: async (ctx, args) => {
			return runPrivateEffect(
				Effect.gen(function* () {
					return yield* options.handler(args as unknown as ObjectType<Args>);
				}).pipe(
					Effect.provideService(ConvexDB, { db: ctx.db })
				)
			) as Promise<R>;
		}
	});
};

export const effectPrivateMutation = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, ConvexDB>;
}) => {
	return privateMutation({
		args: options.args,
		// @ts-expect-error - Convex customQuery generic wrapper TS mismatch
		handler: async (ctx, args) => {
			return runPrivateEffect(
				Effect.gen(function* () {
					return yield* options.handler(args as unknown as ObjectType<Args>);
				}).pipe(
					Effect.provideService(ConvexDB, { db: ctx.db })
				)
			) as Promise<R>;
		}
	});
};

export const effectPrivateAction = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, never>;
}) => {
	return privateAction({
		args: options.args,
		// @ts-expect-error - Convex customQuery generic wrapper TS mismatch
		handler: async (ctx, args) => {
			return runPrivateEffect(
				Effect.gen(function* () {
					return yield* options.handler(args as unknown as ObjectType<Args>);
				})
			) as Promise<R>;
		}
	});
};
