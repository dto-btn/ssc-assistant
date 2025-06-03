import { describe, expect, it } from "vitest";
import { mergeDelta } from "./AgentCoreLlmClientStreaming.utils";

describe('AgentCoreLlmClientStreaming utils', () => {
    describe('mergeDelta', () => {
        it('should merge nested objects correctly', () => {
            const target = { a: { b: 1, c: 2 }, d: 3 };
            const source = { a: { b: 4, e: 5 }, d: 6, f: 7 };
            const expected = { a: { b: 4, c: 2, e: 5 }, d: 6, f: 7 };   
            mergeDelta(target, source);
            expect(target).toEqual(expected);
        });

        it('should merge objects with deeply nested arrays of objects, which also have nested arrays of objects', () => {
            const target = {
                a: {
                    b: [{ x: 1, y: 2 }, { z: 3 }],
                    c: 2
                },
                d: 3
            };
            const source = {
                a: {
                    b: [{ x: 4 }, { w: 5 }],
                    e: 5
                },
                d: 6,
                f: 7
            };
            const expected = {
                a: {
                    b: [{ x: 4, y: 2 }, { z: 3, w: 5 }],
                    c: 2,
                    e: 5
                },
                d: 6,
                f: 7
            };
            mergeDelta(target, source);
            expect(target).toEqual(expected);
        })
    });

});