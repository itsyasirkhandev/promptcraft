import { Context } from 'effect';
import { GenericDatabaseReader, GenericDatabaseWriter, Scheduler } from 'convex/server';
import { DataModel } from '../_generated/dataModel';

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