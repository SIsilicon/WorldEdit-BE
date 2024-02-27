let id = 0;

export function generateId() {
    return `${Date.now().toString(16)}_${(++id).toString(16)}`;
}
