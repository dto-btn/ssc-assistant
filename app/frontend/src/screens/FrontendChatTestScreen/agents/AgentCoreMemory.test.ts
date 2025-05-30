import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentCoreMemory } from "./AgentCoreMemory";
import { MemoryAccessError, MemoryValidationError } from "./AgentCoreErrors";

describe('AgentCoreMemory', () => {
    let memory: AgentCoreMemory;

    beforeEach(() => {
        memory = new AgentCoreMemory();
    });

    describe('adding turns', () => {
        it('should be able to add a user turn', () => {
            const turnIndex = memory.addUserTurn();
            const turns = memory.export();
    
            // Check if the turn was added correctly
            expect(turns.length).toBe(1);
            expect(turns[turnIndex]).toHaveProperty('type', 'turn:user');
            expect(turns[turnIndex].actions).toEqual([]);
        });
        it('should be able to add an agent turn', () => {
            const turnIndex = memory.addAgentTurn();
            const turns = memory.export();
    
            // Check if the turn was added correctly
            expect(turns.length).toBe(1);
            expect(turns[turnIndex]).toHaveProperty('type', 'turn:agent');
            expect(turns[turnIndex].actions).toEqual([]);
        });

        it('should update listeners when a turn is added', () => {
            const listener = vi.fn();
            memory.onUpdate(listener);
            memory.addUserTurn();
            expect(listener).toHaveBeenCalled();
            memory.addAgentTurn();
            expect(listener).toHaveBeenCalledTimes(2);
        });
            
    });

    describe('During the UserTurn', () => {
        beforeEach(() => {
            memory.addUserTurn();
        });

        describe('success cases', () => {
            it('should add a user message action', () => {
                const turnIndex = 0; // The first turn is a user turn
                memory.addTurnAction(turnIndex, { type: 'action:user-message', content: 'Hello' });
                const turns = memory.export();
    
                expect(turns[turnIndex].actions.length).toBe(1);
                expect(turns[turnIndex].actions[0]).toEqual({ type: 'action:user-message', content: 'Hello' });
            });

            it('should notify listeners when an action is added', () => {
                const listener = vi.fn();
                memory.onUpdate(listener);
                const turnIndex = 0; // The first turn is a user turn
                memory.addTurnAction(turnIndex, { type: 'action:user-message', content: 'Hello' });
                expect(listener).toHaveBeenCalled();
            });
        });

        describe('error cases', () => {
            it('should throw an error when adding a non-UserAction to UserTurn', () => {
                const turnIndex = 0; // The first turn is a user turn
                expect(() => {
                    memory.addTurnAction(turnIndex, { type: 'action:agent-message', content: 'This should fail' });
                }).toThrow(MemoryValidationError);
            });

            it('should throw an error when adding an action to a non-existent turn', () => {
                expect(() => {
                    memory.addTurnAction(1, { type: 'action:user-message', content: 'This should fail' });
                }).toThrow(MemoryAccessError);
            });

            it('should not notify listeners when an action fails to be added', () => {
                const listener = vi.fn();
                memory.onUpdate(listener);
                expect(() => {
                    memory.addTurnAction(1, { type: 'action:user-message', content: 'This should fail' });
                }).toThrow(MemoryAccessError);
                expect(listener).not.toHaveBeenCalled();
                expect(() => {
                    memory.addTurnAction(0, { type: 'action:agent-message', content: 'This should fail' });
                }
                ).toThrow(MemoryValidationError);
                expect(listener).not.toHaveBeenCalled();
            });
        });
    });

    describe('During the AgentTurn', () => {   
        beforeEach(() => {
            memory.addAgentTurn();
        });

        it('should add an agent message action', () => {
            const turnIndex = 0; // The first turn is an agent turn
            memory.addTurnAction(turnIndex, { type: 'action:agent-message', content: 'Hello' });
            const turns = memory.export();

            expect(turns[turnIndex].actions.length).toBe(1);
            expect(turns[turnIndex].actions[0]).toEqual({ type: 'action:agent-message', content: 'Hello' });
        });

        it('should throw an error when adding a non-AgentAction to AgentTurn', () => {
            const turnIndex = 0; // The first turn is an agent turn
            expect(() => {
                memory.addTurnAction(turnIndex, { type: 'action:user-message', content: 'This should fail' });
            }).toThrow(MemoryValidationError);
        });

        it('should throw an error when adding an action to a non-existent turn', () => {
            expect(() => {
                memory.addTurnAction(1, { type: 'action:agent-message', content: 'This should fail' });
            }).toThrow(MemoryAccessError);
        });
    });

    describe('export', () => {
        it('should export the memory correctly', () => {
            memory.addUserTurn();
            memory.addAgentTurn();
            memory.addTurnAction(0, { type: 'action:user-message', content: 'Hello' });
            memory.addTurnAction(1, { type: 'action:agent-message', content: 'Hi there!' });

            const exportedMemory = memory.export();

            expect(exportedMemory.length).toBe(2);
            expect(exportedMemory[0]).toEqual({
                type: 'turn:user',
                actions: [{ type: 'action:user-message', content: 'Hello' }]
            });
            expect(exportedMemory[1]).toEqual({
                type: 'turn:agent',
                actions: [{ type: 'action:agent-message', content: 'Hi there!' }]
            });
        });

        it('should handle empty memory export', () => {
            const exportedMemory = memory.export();
            expect(exportedMemory).toEqual([]);
        });

        it('should not notify listeners on export', () => {
            memory.addUserTurn();
            const listener = vi.fn();
            memory.onUpdate(listener);
            memory.export();
            expect(listener).not.toHaveBeenCalled();
        });
    });
});