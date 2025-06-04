import { describe, test, expect, vi, beforeEach } from 'vitest';
import { StateMachine } from './StateMachine';

describe('StateMachine', () => {
  let fsm: StateMachine;

  beforeEach(() => {
    // Reset the state machine before each test
    fsm = new StateMachine('idle');
  });

  test('should initialize with the correct state', () => {
    expect(fsm.currentState).toBe('idle');
    expect(fsm.is('idle')).toBe(true);
    expect(fsm.past).toEqual([]);
  });

  test('should register states with handlers', () => {
    const handler = vi.fn(() => 'next');
    fsm.state('test', handler);
    
    fsm.state('idle', () => 'test'); // transition to 'test' on any event
    fsm.send('SOME EVENT');
    
    expect(fsm.currentState).toBe('test');
  });

  test('should support chainable API', () => {
    // setup
    fsm
      .state('idle', () => 'running')
      .state('running', () => 'idle');

    // It should transition between 'idle' and 'running' states as events are sent
    expect(fsm.currentState).toBe('idle');
    fsm.send('ANY EVENT');
    expect(fsm.currentState).toBe('running');
    expect(fsm.send('ANY EVENT')).toBe(true);
    expect(fsm.currentState).toBe('idle');
  });

  test('should transition between states', () => {
    fsm
      .state('idle', (event) => event === 'START' ? 'running' : undefined)
      .state('running', (event) => event === 'STOP' ? 'idle' : undefined);
    
    expect(fsm.send('START')).toBe(true);
    expect(fsm.currentState).toBe('running');
    
    expect(fsm.send('STOP')).toBe(true);
    expect(fsm.currentState).toBe('idle');
  });

  test('should return false for invalid transitions', () => {
    fsm
      .state('idle', (event) => event === 'START' ? 'running' : undefined)
      .state('running', (event) => event === 'STOP' ? 'idle' : undefined);
    
    expect(fsm.send('INVALID')).toBe(false);
    expect(fsm.currentState).toBe('idle');
  });

  test('should return false when transitioning to the same state', () => {
    fsm.state('idle', () => 'idle');
    
    expect(fsm.send('EVENT')).toBe(false);
    expect(fsm.currentState).toBe('idle');
  });

  test('should return false when current state has no handler', () => {
    fsm = new StateMachine('missing');
    
    expect(fsm.send('EVENT')).toBe(false);
    expect(fsm.currentState).toBe('missing');
  });

  test('should maintain history of state transitions', () => {
    fsm
      .state('idle', () => 'running')
      .state('running', () => 'paused')
      .state('paused', () => 'idle');
    
    fsm.send('EVENT1');
    fsm.send('EVENT2');
    fsm.send('EVENT3');
    
    expect(fsm.past).toEqual(['idle', 'running', 'paused']);
    expect(fsm.currentState).toBe('idle');
  });

  test('should call enter hooks when entering a state', () => {
    const enterHook = vi.fn();
    
    fsm
      .state('idle', () => 'running')
      .state('running', () => undefined, { enter: enterHook });
    
    fsm.send('EVENT');
    
    expect(enterHook).toHaveBeenCalledTimes(1);
  });

  test('should call exit hooks when leaving a state', () => {
    const exitHook = vi.fn();
    
    fsm
      .state('idle', () => 'running', { exit: exitHook })
      .state('running', () => undefined);
    
    fsm.send('EVENT');
    
    expect(exitHook).toHaveBeenCalledTimes(1);
  });

  test('should call both exit and enter hooks during transition', () => {
    const exitHook = vi.fn();
    const enterHook = vi.fn();
    
    fsm
      .state('idle', () => 'running', { exit: exitHook })
      .state('running', () => undefined, { enter: enterHook });
    
    fsm.send('EVENT');
    
    expect(exitHook).toHaveBeenCalledTimes(1);
    expect(enterHook).toHaveBeenCalledTimes(1);
    expect(exitHook).toHaveBeenCalledBefore(enterHook);
  });

  test('should handle complex state transitions with hooks', () => {
    const hooks = {
      idleEnter: vi.fn(),
      idleExit: vi.fn(),
      runningEnter: vi.fn(),
      runningExit: vi.fn(),
      pausedEnter: vi.fn(),
      pausedExit: vi.fn(),
    };
    
    fsm
      .state('idle', (event) => {
        if (event === 'START') return 'running';
        return undefined;
      }, { enter: hooks.idleEnter, exit: hooks.idleExit })
      
      .state('running', (event) => {
        if (event === 'PAUSE') return 'paused';
        if (event === 'STOP') return 'idle';
        return undefined;
      }, { enter: hooks.runningEnter, exit: hooks.runningExit })
      
      .state('paused', (event) => {
        if (event === 'RESUME') return 'running';
        if (event === 'STOP') return 'idle';
        return undefined;
      }, { enter: hooks.pausedEnter, exit: hooks.pausedExit });
    
    // Transition: idle -> running
    fsm.send('START');
    expect(fsm.currentState).toBe('running');
    expect(hooks.idleExit).toHaveBeenCalledTimes(1);
    expect(hooks.runningEnter).toHaveBeenCalledTimes(1);
    
    // Transition: running -> paused
    fsm.send('PAUSE');
    expect(fsm.currentState).toBe('paused');
    expect(hooks.runningExit).toHaveBeenCalledTimes(1);
    expect(hooks.pausedEnter).toHaveBeenCalledTimes(1);
    
    // Transition: paused -> running
    fsm.send('RESUME');
    expect(fsm.currentState).toBe('running');
    expect(hooks.pausedExit).toHaveBeenCalledTimes(1);
    expect(hooks.runningEnter).toHaveBeenCalledTimes(2);
    
    // Transition: running -> idle
    fsm.send('STOP');
    expect(fsm.currentState).toBe('idle');
    expect(hooks.runningExit).toHaveBeenCalledTimes(2);
    expect(hooks.idleEnter).toHaveBeenCalledTimes(1);
    
    // Check history
    expect(fsm.past).toEqual(['idle', 'running', 'paused', 'running']);
  });
  
  test('should pass event and machine reference to handler', () => {
    const handler = vi.fn(() => 'next');
    
    fsm.state('idle', handler);
    fsm.send('EVENT');
    
    expect(handler).toHaveBeenCalledWith('EVENT', fsm);
  });

  test('should allow state handlers to check current state', () => {
    fsm
      .state('idle', (_, machine) => {
        expect(machine.is('idle')).toBe(true);
        expect(machine.currentState).toBe('idle');
        return 'next';
      })
      .state('next', () => undefined);
    
    fsm.send('EVENT');
  });
});
