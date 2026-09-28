/**
 * Measures active response time. Time does not accumulate while any "hold" is active
 * (narration speaking, feedback animation, pause dialog, hidden browser tab).
 */
export class ActiveTimer {
  private total = 0;
  private since: number | null = null;
  private holds = new Set<string>();
  private interruptions = 0;
  private started = false;
  constructor(private now: () => number = () => performance.now()) {}

  start(): void {
    this.started = true;
    this.maybeResume();
  }
  hold(reason: string): void {
    if (reason === 'hidden' && !this.holds.has('hidden') && this.started) this.interruptions++;
    this.flush();
    this.holds.add(reason);
  }
  release(reason: string): void {
    this.holds.delete(reason);
    this.maybeResume();
  }
  stop(): number {
    this.flush();
    this.started = false;
    return this.total;
  }
  elapsed(): number {
    return this.total + (this.since !== null ? this.now() - this.since : 0);
  }
  interruptionCount(): number {
    return this.interruptions;
  }
  private flush() {
    if (this.since !== null) {
      this.total += this.now() - this.since;
      this.since = null;
    }
  }
  private maybeResume() {
    if (this.started && this.holds.size === 0 && this.since === null) this.since = this.now();
  }
}
