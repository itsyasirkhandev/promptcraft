/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authed_billing from "../authed/billing.js";
import type * as authed_demo from "../authed/demo.js";
import type * as authed_errors from "../authed/errors.js";
import type * as authed_helpers from "../authed/helpers.js";
import type * as authed_promptAnalytics from "../authed/promptAnalytics.js";
import type * as authed_prompts from "../authed/prompts.js";
import type * as authed_users from "../authed/users.js";
import type * as authed_validation from "../authed/validation.js";
import type * as billing_lifecycle from "../billing/lifecycle.js";
import type * as billing_polarClient from "../billing/polarClient.js";
import type * as billing_provider from "../billing/provider.js";
import type * as billing_sync from "../billing/sync.js";
import type * as billing_webhooks from "../billing/webhooks.js";
import type * as effectHelpers from "../effectHelpers.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as private_demo from "../private/demo.js";
import type * as private_helpers from "../private/helpers.js";
import type * as private_users from "../private/users.js";
import type * as services_ConvexDB from "../services/ConvexDB.js";
import type * as services_ServerConfig from "../services/ServerConfig.js";
import type * as userQueries from "../userQueries.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "authed/billing": typeof authed_billing;
  "authed/demo": typeof authed_demo;
  "authed/errors": typeof authed_errors;
  "authed/helpers": typeof authed_helpers;
  "authed/promptAnalytics": typeof authed_promptAnalytics;
  "authed/prompts": typeof authed_prompts;
  "authed/users": typeof authed_users;
  "authed/validation": typeof authed_validation;
  "billing/lifecycle": typeof billing_lifecycle;
  "billing/polarClient": typeof billing_polarClient;
  "billing/provider": typeof billing_provider;
  "billing/sync": typeof billing_sync;
  "billing/webhooks": typeof billing_webhooks;
  effectHelpers: typeof effectHelpers;
  emails: typeof emails;
  http: typeof http;
  "private/demo": typeof private_demo;
  "private/helpers": typeof private_helpers;
  "private/users": typeof private_users;
  "services/ConvexDB": typeof services_ConvexDB;
  "services/ServerConfig": typeof services_ServerConfig;
  userQueries: typeof userQueries;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
