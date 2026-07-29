import { UnauthorizedError } from './errors';
import { customAction, customCtxAndArgs, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { action, mutation, query, type QueryCtx, type MutationCtx, type ActionCtx } from '../_generated/server';
import { ConvexError, type ObjectType, type PropertyValidators } from 'convex/values';
import { Context, Effect } from 'effect';
import type { UserIdentity } from 'convex/server';
import type { Doc } from '../_generated/dataModel';
import { ConvexDB, ConvexScheduler, ConvexActions } from '../services/ConvexDB';
import { runEffect, effectHandler } from "../effectHelpers";
import { queryUserByToken } from "../userQueries";

export class AuthedContext extends Context.Service<AuthedContext, { identity: UserIdentity; viewer: Doc<'users'> | null }>()('AuthedContext') {}

export async function runAuthedEffect<Result, Error>(effect: Effect.Effect<Result, Error, never>): Promise<Result> {
	return runEffect(effect);
}

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new ConvexError({ tag: 'UnauthorizedError', data: { message: 'Not authenticated' } });
	return identity;
}

async function getViewer(ctx: QueryCtx | MutationCtx, identity: UserIdentity) {
	return queryUserByToken(ctx.db, identity.tokenIdentifier);
}

async function authedInput<Ctx extends QueryCtx | MutationCtx>(ctx: Ctx) {
	const identity = await requireIdentity(ctx);
	const viewer = await getViewer(ctx, identity);
	return { ctx: { ...ctx, identity, viewer }, args: {} };
}

const authQueryGuard = customCtxAndArgs({ args: {}, input: async (ctx: QueryCtx) => authedInput(ctx) });
const authMutationGuard = customCtxAndArgs({ args: {}, input: async (ctx: MutationCtx) => authedInput(ctx) });
const authActionGuard = customCtxAndArgs({
	args: {},
	input: async (ctx: ActionCtx) => ({ ctx: { ...ctx, identity: await requireIdentity(ctx) }, args: {} })
});

export const authedQuery = customQuery(query, authQueryGuard);
export const authedMutation = customMutation(mutation, authMutationGuard);
export const authedAction = customAction(action, authActionGuard);

export const effectAuthedQuery = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, AuthedContext | ConvexDB>;
}) => authedQuery({
	args: options.args,
	handler: effectHandler(runAuthedEffect, options, (ctx) => (effect) => effect.pipe(
		Effect.provideService(AuthedContext, { identity: ctx.identity, viewer: ctx.viewer }),
		Effect.provideService(ConvexDB, { db: ctx.db }),
	)),
});

export const effectAuthedMutation = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, AuthedContext | ConvexDB | ConvexScheduler>;
}) => authedMutation({
	args: options.args,
	handler: effectHandler(runAuthedEffect, options, (ctx) => (effect) => effect.pipe(
		Effect.provideService(AuthedContext, { identity: ctx.identity, viewer: ctx.viewer }),
		Effect.provideService(ConvexDB, { db: ctx.db }),
		Effect.provideService(ConvexScheduler, { scheduler: ctx.scheduler }),
	)),
});

export const effectAuthedAction = <Args extends PropertyValidators, R, E>(options: {
	args: Args;
	handler: (args: ObjectType<Args>) => Effect.Effect<R, E, AuthedContext | ConvexScheduler | ConvexActions>;
}) => authedAction({
	args: options.args,
	handler: effectHandler(runAuthedEffect, options, (ctx) => (effect) => effect.pipe(
		Effect.provideService(AuthedContext, { identity: ctx.identity, viewer: null }),
		Effect.provideService(ConvexScheduler, { scheduler: ctx.scheduler }),
		Effect.provideService(ConvexActions, { runQuery: ctx.runQuery, runMutation: ctx.runMutation }),
	)),
});

export const requireViewer = (message = 'Not authenticated') => Effect.gen(function* () {
	const { viewer } = yield* AuthedContext;
	if (!viewer) return yield* Effect.fail(new UnauthorizedError({ message }));
	return viewer;
});
