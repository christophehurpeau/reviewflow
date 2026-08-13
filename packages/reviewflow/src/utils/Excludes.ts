export const ExcludesFalsy = Boolean as any as <T>(
  x: T | "" | 0 | false | null | undefined,
) => x is T;

export const ExcludesNullish = ((res: any) => res !== null) as any as <T>(
  x: T | null,
) => x is T;
