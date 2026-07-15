import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { Effect, Schema } from 'effect';
import { runEffect } from './effectHelpers';

export class BrevoApiError extends Schema.TaggedErrorClass<BrevoApiError>()('BrevoApiError', {
  status: Schema.Number,
  body: Schema.String,
}) {}

export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const program = Effect.gen(function* () {
      const brevoApiKey = process.env.BREVO_API_KEY;
      if (!brevoApiKey) {
        yield* Effect.logWarning(
          'BREVO_API_KEY is not set. Welcome email will not be sent.',
        );
        return;
      }

      const userName = args.name || 'there';

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Promptcraft</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Welcome to Promptcraft!</h2>
    <p>Hi ${userName},</p>
    <p>Your account has been successfully created. You're all set to start creating, refining, and organizing your prompts.</p>
    <p>If you have any questions or need help getting started, just reply to this email — we're happy to help.</p>
    <br/>
    <p>Best regards,</p>
    <p>The Promptcraft Team</p>
  </div>
</body>
</html>`;

      yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': brevoApiKey,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              sender: { name: 'Promptcraft Team', email: 'yasirwebio@gmail.com' },
              to: [{ email: args.email, ...(args.name ? { name: args.name } : {}) }],
              subject: 'Welcome to Promptcraft!',
              htmlContent,
            }),
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new BrevoApiError({ status: res.status, body: errorText });
          }
          return res;
        },
        catch: (e) =>
          e instanceof BrevoApiError
            ? e
            : new BrevoApiError({ status: 0, body: String(e) }),
      });

      yield* Effect.logInfo(`Welcome email sent to ${args.email}`);
    }).pipe(
      Effect.catchTag('BrevoApiError', (error) =>
        Effect.gen(function* () {
          yield* Effect.logError(
            `Brevo API failure (${error.status}): ${error.body}`,
          );
        }),
      ),
    );

    await runEffect(program);
  },
});
