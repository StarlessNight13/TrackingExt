export function createId(prefix?: string) {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function historyId(operationId: string) {
  return `hist_${operationId}`;
}
