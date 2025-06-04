type StateHandler = (event: string, machine: StateMachine) => string | void;
type StateHooks = { enter?: () => void; exit?: () => void };

export class StateMachine {
  private current: string;
  private states: Record<string, StateHandler> = {};
  private hooks: Record<string, StateHooks> = {};
  private history: string[] = [];

  constructor(initial: string) {
    this.current = initial;
  }

  state(name: string, handler: StateHandler, hooks?: StateHooks) {
    this.states[name] = handler;
    if (hooks) this.hooks[name] = hooks;
    return this; // chainable
  }

  send(event: string): boolean {
    const handler = this.states[this.current];
    if (!handler) return false;

    const next = handler(event, this);
    if (!next || next === this.current) return false;

    this.hooks[this.current]?.exit?.();
    this.history.push(this.current);
    this.current = next;
    this.hooks[this.current]?.enter?.();
    
    return true;
  }

  is(state: string) { return this.current === state; }
  get currentState() { return this.current; }
  get past() { return [...this.history]; }
}