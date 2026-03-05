import { describe, it, expect } from 'vitest';
import { MinHeap } from './min-heap';

describe('MinHeap', () => {
  it('pops elements in ascending order', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(5);
    heap.push(1);
    heap.push(3);
    heap.push(2);
    heap.push(4);

    const result: number[] = [];
    while (heap.size > 0) {
      result.push(heap.pop()!);
    }
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns undefined when empty', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    expect(heap.pop()).toBeUndefined();
    expect(heap.peek()).toBeUndefined();
  });

  it('tracks size correctly', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    expect(heap.size).toBe(0);
    heap.push(1);
    expect(heap.size).toBe(1);
    heap.push(2);
    expect(heap.size).toBe(2);
    heap.pop();
    expect(heap.size).toBe(1);
  });

  it('peek returns minimum without removing', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(3);
    heap.push(1);
    heap.push(2);
    expect(heap.peek()).toBe(1);
    expect(heap.size).toBe(3);
  });

  it('works with custom comparator (objects)', () => {
    const heap = new MinHeap<{ f: number }>((a, b) => a.f - b.f);
    heap.push({ f: 10 });
    heap.push({ f: 3 });
    heap.push({ f: 7 });

    expect(heap.pop()!.f).toBe(3);
    expect(heap.pop()!.f).toBe(7);
    expect(heap.pop()!.f).toBe(10);
  });

  it('handles duplicates', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(2);
    heap.push(2);
    heap.push(1);
    heap.push(2);

    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBe(2);
    expect(heap.pop()).toBe(2);
    expect(heap.pop()).toBe(2);
  });

  it('handles single element', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(42);
    expect(heap.pop()).toBe(42);
    expect(heap.size).toBe(0);
  });
});
