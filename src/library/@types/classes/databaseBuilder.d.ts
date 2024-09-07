// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Database<T = { [key: string]: any }> {
    /**
     * Save a value or update a value in the Database under a key
     * @param key The key you want to save the value as
     * @param value The value you want to save
     * @example Database.set('Test Key', 'Test Value');
     */
    set<S extends keyof T>(key: S, value: T[S]): void;

    /**
     * Get the value of the key
     * @param key
     * @returns value
     * @example Database.get('Test Key');
     */
    get<S extends keyof T>(key: S): T[S];

    /**
     * Check if the key exists in the table
     * @param key
     * @returns Whether the key exists
     * @example Database.has('Test Key');
     */
    has(key: keyof T): boolean;

    /**
     * Delete the key from the table
     * @param key
     * @example Database.delete('Test Key');
     */
    delete(key: keyof T): void;

    /**
     * Clear everything in the table
     * @example Database.clear()
     */
    clear(): void;

    /**
     * Save all changes made in the database.
     * @example Database.save()
     */
    save(): void;

    /**
     * Get all the keys in the database
     * @returns Array of keys
     * @example Database.keys();
     */
    keys(): (keyof T)[];

    /**
     * Get all the values in the database
     * @returns Array of values
     * @example Database.values();
     */
    values(): T[keyof T][];

    /**
     * Get all the keys and values in the database in pairs
     * @returns Array of key/value pairs
     * @example Database.entries();
     */
    entries<S extends keyof T>(): [S, T[S]][];
}
