export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function mapZodErrors<T extends Record<string, unknown>>(
  result: { success: false; error: { issues: { path: (string | number)[]; message: string }[] } },
): FieldErrors<keyof T & string> {
  const errors: FieldErrors<keyof T & string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !errors[field as keyof T & string]) {
      errors[field as keyof T & string] = issue.message;
    }
  }
  return errors;
}
