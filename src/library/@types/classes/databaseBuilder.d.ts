// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Database<T = { [key: string]: any }> {
    /** Database's data. */
    data: T;

    /** Returns whether the database is a valid object that can have functions called and data read from. */
    isValid(): boolean;

    /** Returns whether the database has loaded its data from its provider. */
    isLoaded(): boolean;

    /** Clears everything in the database. */
    clear(): void;

    /** Saves all changes made in the database. */
    save(): void;

    /** Deletes the database from the provider it was loaded from. */
    delete(): void;
}
