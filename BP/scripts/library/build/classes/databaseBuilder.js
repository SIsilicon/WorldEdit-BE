import { Server } from '../classes/serverBuilder.js';
export default class Database {
    constructor(table) {
        if (!table)
            throw `[Database] constructor(): Error - Provide a table name`;
        Server.runCommand('scoreboard objectives add GAMETEST_DB dummy');
        this.table = table;
        this._createTable();
    }
    ;
    /**
     * @private
     */
    _createTable() {
        if (this._getTable())
            return;
        let json = { GAMETEST_DB_TABLE: this.table };
        return Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify(json))} GAMETEST_DB 0`);
    }
    ;
    /**
     * @private
     */
    _getTable() {
        const data = Server.runCommand(`scoreboard players list`);
        if (data.error)
            return;
        const objectiveUsers = data.statusMessage.match(/(?<=\n).*/)[0];
        const player = objectiveUsers.replace(/\\"/g, '"').match(new RegExp(`({"GAMETEST_DB_TABLE":"${this.table}".*?}+(?=,\\s)|{"GAMETEST_DB_TABLE":"${this.table}".*?}+$)`));
        if (player)
            return JSON.parse(player[0]);
        else
            throw `[Database]: Error - Table "${this.table}" doesn't exist, please restart the world to possibly fix this issue`;
    }
    ;
    /**
     * Save a value or update a value in the Database under a key
     * @param {string} Key The key you want to save the value as
     * @param {any} value The value you want to save
     * @example Database.set('Test Key', 'Test Value');
     */
    set(key, value) {
        let json = this._getTable();
        if (typeof value === 'string')
            value = value.replace(/"/g, "'");
        Server.runCommand(`scoreboard players reset ${JSON.stringify(JSON.stringify(json))} GAMETEST_DB`);
        Object.assign(json, { [key]: value });
        Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify(json))} GAMETEST_DB 0`);
    }
    ;
    /**
     * Get the value of the key
     * @param {string} key
     * @returns {any}
     * @example Database.get('Test Key');
     */
    get(key) {
        let json = this._getTable();
        return json[key];
    }
    ;
    /**
     * Check if the key exists in the table
     * @param {string} key
     * @returns {boolean}
     * @example Database.has('Test Key');
     */
    has(key) {
        return this.keys().includes(key);
    }
    ;
    /**
     * Delete the key from the table
     * @param {string} key
     * @returns {boolean}
     * @example Database.delete('Test Key');
     */
    delete(key) {
        let json = this._getTable();
        Server.runCommand(`scoreboard players reset ${JSON.stringify(JSON.stringify(json))} GAMETEST_DB`);
        const status = delete json[key];
        Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify(json))} GAMETEST_DB 0`);
        return status;
    }
    ;
    /**
     * Clear everything in the table
     * @example Database.clear()
     */
    clear() {
        let json = this._getTable();
        Server.runCommand(`scoreboard players reset ${JSON.stringify(JSON.stringify(json))} GAMETEST_DB`);
        json = { GAMETEST_DB_TABLE: this.table };
        Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify(json))} GAMETEST_DB 0`);
    }
    ;
    /**
     * Get all the keys in the table
     * @returns {Array<string>}
     * @example Database.keys();
     */
    keys() {
        let json = this._getTable();
        delete json["GAMETEST_DB_TABLE"];
        return Object.keys(json);
    }
    ;
    /**
     * Get all the values in the table
     * @returns {Array<any>}
     * @example Database.values();
     */
    values() {
        let json = this._getTable();
        delete json["GAMETEST_DB_TABLE"];
        return Object.values(json);
    }
    ;
    /**
     * Gets all the keys and values
     * @returns {any}
     * @example Database.getCollection();
     */
    getCollection() {
        let json = this._getTable();
        delete json["GAMETEST_DB_TABLE"];
        return json;
    }
    ;
    /**
     * Check if all the keys exists in the table
     * @param {string} keys
     * @returns {boolean}
     * @example Database.hasAll('Test Key', 'Test Key 2', 'Test Key 3');
     */
    hasAll(...keys) {
        return keys.every((k) => this.has(k));
    }
    ;
    /**
     * Check if any of the keys exists in the table
     * @param {string} keys
     * @returns {boolean}
     * @example Database.hasAny('Test Key', 'Test Key 2', 'Test Key 3');
     */
    hasAny(...keys) {
        return keys.some((k) => this.has(k));
    }
    ;
    /**
     * Get all the key(s) from the beginning of the table
     * @param {number} [amount]
     * @returns {Array<string>}
     * @example Database.firstKey(2);
     */
    firstKey(amount) {
        const keys = this.keys();
        if (typeof amount !== 'number')
            return [keys[0]];
        if (!amount)
            return [];
        if (amount < 0)
            return this.lastKey(amount * -1);
        return keys.slice(0, amount);
    }
    ;
    /**
     * Get all the values(s) from the beginning of the table
     * @param {number} [amount]
     * @returns {Array<any>}
     * @example Database.firstValue(2);
     */
    firstValue(amount) {
        const values = this.values();
        if (typeof amount !== 'number')
            return [values[0]];
        if (!amount)
            return [];
        if (amount < 0)
            return this.lastValue(amount * -1);
        return values.slice(0, amount);
    }
    ;
    /**
     * Get all the key(s) from the end of the table
     * @param {number} [amount]
     * @returns {Array<string>}
     * @example Database.lastKey();
     */
    lastKey(amount) {
        const keys = this.keys();
        if (typeof amount !== 'number')
            return [keys[keys.length - 1]];
        if (!amount)
            return [];
        if (amount < 0)
            return this.firstKey(amount * -1);
        return keys.slice(-amount).reverse();
    }
    ;
    /**
     * Get all the values(s) from the end of the table
     * @param {number} [amount]
     * @returns {Array<any>}
     * @example Database.lastValue();
     */
    lastValue(amount) {
        const values = this.values();
        if (typeof amount !== 'number')
            return [values[values.length - 1]];
        if (!amount)
            return [];
        if (amount < 0)
            return this.firstValue(amount * -1);
        return values.slice(-amount).reverse();
    }
    ;
    /**
     * Get random key(s)
     * @param {number} amount
     * @returns {Array<string>}
     * @example Database.randomKey(3);
     */
    randomKey(amount) {
        const keys = this.keys();
        return keys.sort(() => Math.random() - Math.random()).slice(0, Math.abs(amount));
    }
    ;
    /**
     * Get random value(s)
     * @param {number} amount
     * @returns {Array<string>}
     * @example Database.randomValue(3);
     */
    randomValue(amount) {
        const values = this.values();
        return values.sort(() => Math.random() - Math.random()).slice(0, Math.abs(amount));
    }
    ;
}
;
