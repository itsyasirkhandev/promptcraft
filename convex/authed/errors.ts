import { Schema } from 'effect';

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()("UnauthorizedError", {
	message: Schema.String
}) {}

export class UserNotFoundError extends Schema.TaggedErrorClass<UserNotFoundError>()("UserNotFoundError", {
	message: Schema.String,
	userId: Schema.optional(Schema.String)
}) {}

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()("ValidationError", {
	message: Schema.String,
	field: Schema.optional(Schema.String)
}) {}
