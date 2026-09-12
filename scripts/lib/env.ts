export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
export function requireDemoMode(): void {
  if (process.env.ACCORD_MODE !== 'demo') throw new Error('This command only runs when ACCORD_MODE=demo.');
}
export function fixedDemoClock(): string {
  const value = process.env.ACCORD_DEMO_AS_OF ?? '2026-09-12T00:00:00.000Z';
  if (value !== '2026-09-12T00:00:00.000Z') throw new Error('This fixture supports only ACCORD_DEMO_AS_OF=2026-09-12T00:00:00.000Z.');
  return value;
}
