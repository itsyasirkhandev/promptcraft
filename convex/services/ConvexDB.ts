import { Context } from 'effect';
import { GenericDatabaseReader, GenericDatabaseWriter, Scheduler } from 'convex/server';
import { DataModel } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';

/** @effect-leakable-service */
export class ConvexDB extends Context.Service<
	ConvexDB,
	{ db: GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel> }
>()('ConvexDB') {}

/** @effect-leakable-service — exposes ctx.scheduler to Effect handlers (Phase 3 scheduling). */
export class ConvexScheduler extends Context.Service<
	ConvexScheduler,
	{ scheduler: Scheduler }
>()('ConvexScheduler') {}

/** @effect-leakable-service — exposes ctx.runQuery/ctx.runMutation to Effect action handlers (Phase 4). */
export class ConvexActions extends Context.Service<
	ConvexActions,
	{ runQuery: ActionCtx['runQuery']; runMutation: ActionCtx['runMutation'] }
>()('ConvexActions') {}
