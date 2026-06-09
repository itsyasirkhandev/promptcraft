import {
	customAction,
	customCtxAndArgs,
	customMutation,
	customQuery
} from 'convex-helpers/server/customFunctions';
import { action, mutation, query } from '../_generated/server';
import { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server';
import { ConvexError, ObjectType, PropertyValidators } from 'convex/values';
import { Context, Effect } from 'effect';
import { UserIdentity } from 'convex/server';
import { Doc } from '../_generated/dataModel';
import { ConvexDB } from '../services/ConvexDB';

/** @effect-leakable-service */
export class AuthedContext extends Context.Service<
	AuthedContext,
	{ identity: UserIdentity; viewer: Doc<'users'> | null }
>()('AuthedContext') {}

export async function runAuthedEffect<Result, Error>(
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

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }) {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throw new ConvexError({
			tag: 'UnauthorizedError',
			data: { message: 'Not authenticated' }
		});
	}
	return identity;
}

async function getViewer(ctx: QueryCtx | MutationCtx, tokenIdentifier: string) {
	return await ctx.db
		.query('users')
		.withIndex('by_token', (q) => q.eq('tokenIdentifier', tokenIdentifier))
		.unique();
}

const authQueryGuard = customCtxAndArgs({
	args: {},
	input: async (ctx: QueryCtx) => {
		const identity = await requireIdentity(ctx);
		const viewer = await getViewer(ctx, identity.tokenIdentifier);
		return { ctx: { ...ctx, identity, viewer }, args: {} };
	}
});

const authMutationGuard = customCtxAndArgs({
	args: {},
	input: async (ctx: MutationCtx) => {
		const identity = await requireIdentity(ctx);
		const viewer = await getViewer(ctx, identity.tokenIdentifier);
		return { ctx: { ...ctx, identity, viewer }, args: {} };
	}
});

const authActionGuard = customCtxAndArgs({
	args: {},
	input: async (ctx: ActionCtx) => {
		const identity = await requireIdentity(ctx);
		return { ctx: { ...ctx, identity }, args: {} };
	}
});

export const authedQuery = customQuery(query, authQueryGuard);
export const authedMutation = customMutation(mutation, authMutationGuard);
export const authedAction = customAction(action, authActionGuard);

export const effectAuthedQuery = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, AuthedContext | ConvexDB>;
}) => {
	return authedQuery({
		args: options.args,
		// @ts-expect-error - Convex customQuery generic wrapper TS mismatch
		handler: async (ctx, args) => {
			return runAuthedEffect(
				Effect.gen(function* () {
					return yield* options.handler(args as unknown as ObjectType<Args>);
				}).pipe(
					Effect.provideService(AuthedContext, { identity: ctx.identity, viewer: ctx.viewer }),
					Effect.provideService(ConvexDB, { db: ctx.db })
				)
			) as Promise<R>;
		}
	});
};

export const effectAuthedMutation = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, AuthedContext | ConvexDB>;
}) => {
	return authedMutation({
		args: options.args,
		// @ts-expect-error - Convex customQuery generic wrapper TS mismatch
		handler: async (ctx, args) => {
			return runAuthedEffect(
				Effect.gen(function* () {
					return yield* options.handler(args as unknown as ObjectType<Args>);
				}).pipe(
					Effect.provideService(AuthedContext, { identity: ctx.identity, viewer: ctx.viewer }),
					Effect.provideService(ConvexDB, { db: ctx.db })
				)
			) as Promise<R>;
		}
	});
};

export const effectAuthedAction = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, AuthedContext>;
}) => {
	return authedAction({
		args: options.args,
		// @ts-expect-error - Convex customQuery generic wrapper TS mismatch
		handler: async (ctx, args) => {
			return runAuthedEffect(
				Effect.gen(function* () {
					return yield* options.handler(args as unknown as ObjectType<Args>);
				}).pipe(
					Effect.provideService(AuthedContext, { identity: ctx.identity, viewer: null })
				)
			) as Promise<R>;
		}
	});
};
