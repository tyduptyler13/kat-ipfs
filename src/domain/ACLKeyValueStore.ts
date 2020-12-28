import IPFS from "ipfs";
import {Identity} from "orbit-db-identity-provider";
import Store from "orbit-db-store";
import ACLAccessController, {AccessType} from "./ACLAccessController";
import OrbitDB from "orbit-db";
import AccessController from "orbit-db-access-controllers/src/access-controller-interface";

export interface Log<T> {
    values: Array<LogEntry<T>>;
}

export interface Index<T> {
    readonly _index: any;

    get(key: string): T | null;

    updateIndex(oplog: Log<T>): void;
}

/**
 * A modification of the normal keyvalue index in that it stores additional log entry data as the values in order to preserve
 * access information. This may require significantly more memory but allows access to be controlled on a per entry basis.
 */
export class ACLKeyValueIndex<T> implements Index<T> {
    readonly _index = new Map<string, {
        value: T;
        id: string;
    }>()

    get(key: string) {
        return this._index.get(key)?.value ?? null
    }

    updateIndex(oplog: Log<T>) {
        oplog.values
            .slice()
            .reverse()
            .reduce((handled: Set<string>, item: LogEntry<T>) => {
                // Inherit and improve (made it safer) the logic from the original. Not sure what its for yet...
                if (item.payload.key && !handled.has(item.payload.key)) {
                    handled.add(item.payload.key);
                    if (item.payload.op === 'PUT') {
                        this._index.set(item.payload.key, {
                            value: item.payload.value,
                            id: item.identity.id
                        });
                    } else if (item.payload.op === 'DEL') {
                        this._index.delete(item.payload.key);
                    }
                }
                return handled;
            }, new Set<string>())
    }
}

declare module "orbit-db-store" {
    // It would be ideal if we could extend this to include generics for the hidden index
    export default interface Store {
        readonly _index: Index<any>;
        readonly access: AccessController;
    }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore (Ignore the fact we are overriding the default definition of Store with a generified one)
export default class ACLKeyValueStore<T> extends Store {
    constructor(ipfs: IPFS.IPFS, id: Identity, dbname: string, options: IStoreOptions) {
        super(ipfs, id, dbname, Object.assign({Index: ACLKeyValueIndex}, options))

        if (!(this.access.type === ACLAccessController.type)) {
            throw new Error("Expected the access controller to be an instances of ACLAccessController")
        }

        // We have already read the controller from the options
        (this.access as ACLAccessController).determineAccessType = this.determineAccessType.bind(this);
    }

    static type = 'aclkeyvalue'

    get type() {
        return ACLKeyValueStore.type
    }

    get all() {
        return this._index._index;
    }

    get(key: string): T {
        return this._index.get(key)
    }

    set(key: string, data: T, options = {}) {
        return this.put(key, data, options)
    }

    put(key: string, data: T, options = {}) {
        return this._addOperation({
            op: 'PUT',
            key: key,
            value: data
        }, options)
    }

    del(key: string, options = {}) {
        return this._addOperation({
            op: 'DEL',
            key: key,
            value: null
        }, options)
    }

    private async determineAccessType(entry: LogEntry<never>): Promise<AccessType> {
        const existing = (this._index as ACLKeyValueIndex<never>)._index.get(entry.payload.key!!);

        if (existing) {
            if (existing.id === entry.identity.id) {
                switch (entry.payload.op) {
                    case 'PUT':
                        return AccessType.updateOwn;
                    case 'DEL':
                        return AccessType.deleteOwn;
                }
            } else {
                switch (entry.payload.op) {
                    case 'PUT':
                        return AccessType.updateOther;
                    case 'DEL':
                        return AccessType.deleteOther;
                }
            }
        }

        if (entry.payload.op === 'DEL') {
            return AccessType.noop; // The entry doesn't exist but its being deleted...
        }

        // The entry doesn't exist and we aren't deleting it, that only leaves a create
        return AccessType.create;
    }
}

OrbitDB.addDatabaseType(ACLKeyValueStore.type, ACLKeyValueStore)
