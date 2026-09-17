export async function runCleanupSteps(
  message: string,
  steps: readonly (() => Promise<void>)[],
): Promise<void> {
  const errors: unknown[] = [];

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length === 1) {
    throw errors[0];
  }

  if (errors.length > 1) {
    throw new AggregateError(errors, message);
  }
}
