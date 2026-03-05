// =============================================================================
// Generic Binary Min-Heap
// =============================================================================

export class MinHeap<T> {
  private readonly data: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  get size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0]!;
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i]!, this.data[parent]!) >= 0) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.data[left]!, this.data[smallest]!) < 0) {
        smallest = left;
      }
      if (right < n && this.compare(this.data[right]!, this.data[smallest]!) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const tmp = this.data[i]!;
    this.data[i] = this.data[j]!;
    this.data[j] = tmp;
  }
}
