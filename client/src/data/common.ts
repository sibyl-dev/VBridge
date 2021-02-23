export function distinct<T> (value: T, index: number, self: Array<T>) {
    return self.indexOf(value) === index;
}