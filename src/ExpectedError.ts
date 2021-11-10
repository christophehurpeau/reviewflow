export class ExpectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpectedError';
  }
}

export async function catchExceptedErrors(
  callback: () => Promise<void> | void,
): Promise<void> {
  try {
    await callback();
  } catch (err) {
    if (err instanceof ExpectedError) {
      return;
    }
    throw err;
  }
}
