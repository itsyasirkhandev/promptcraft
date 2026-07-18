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
import { ObjectType, PropertyValidators } from 'convex/values';
import { Effect } from 'effect';
import { ConvexDB, ConvexScheduler } from '../services/ConvexDB';
import { ServerConfig } from '../services/ServerConfig';
import { runEffect, effectHandler } from "../effectHelpers";

const apiKeyGuard = customCtxAndArgs({
	args: { apiKey: v.string() },
	input: async (ctx, { apiKey }) => {
		const config = await Effect.runPromise(
			ServerConfig.pipe(Effect.provide(ServerConfig.layer))
		);
		if (apiKey !== config.convexPrivateBridgeKey) {
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
	return runEffect(effect);
}

export const effectPrivateQuery = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, ConvexDB>;
}) =>
	privateQuery({
		args: options.args,
		handler: effectHandler(
			runPrivateEffect,
			options,
			(ctx) => (effect) =>
				effect.pipe(Effect.provideService(ConvexDB, { db: ctx.db })),
		),
	});

export const effectPrivateMutation = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, ConvexDB | ConvexScheduler>;
}) =>
	privateMutation({
		args: options.args,
		handler: effectHandler(
			runPrivateEffect,
			options,
			(ctx) => (effect) =>
				effect.pipe(
					Effect.provideService(ConvexDB, { db: ctx.db }),
					Effect.provideService(ConvexScheduler, { scheduler: ctx.scheduler }),
				),
		),
	});

export const effectPrivateAction = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, ConvexScheduler>;
}) =>
	privateAction({
		args: options.args,
		handler: effectHandler(
			runPrivateEffect,
			options,
			(ctx) => (effect) =>
				effect.pipe(Effect.provideService(ConvexScheduler, { scheduler: ctx.scheduler })),
		),
	});
