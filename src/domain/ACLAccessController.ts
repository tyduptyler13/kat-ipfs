/* eslint-disable @typescript-eslint/ban-ts-ignore */
import AccessController from "orbit-db-access-controllers/src/access-controller-interface";
import AccessControllers from "orbit-db-access-controllers";
import Identities, {IdentityProvider} from "orbit-db-identity-provider";
import KeyValueStore from "orbit-db-kvstore";
import OrbitDB from "orbit-db";

export enum AccessType {
	create,
	updateOwn,
	updateOther,
	deleteOwn,
	deleteOther,
	noop, // Special case where the operation would result in no change.
}

export class AccessFlags {
	create = true
	updateOwn = true
	updateOther = false
	deleteOwn = true
	deleteOther = false
	// Future: add ability to manage groups (allow other users to modify your content within your own group)
}

export interface ACLAccessControllerOptions {
	address?: string;
	determineAccessType?: (entry: LogEntry<never>) => Promise<AccessType>;
	defaultAccessFlags?: AccessFlags;
	creatorHasAllPerms?: boolean;
}

/**
 * An access controller where the first person to post an entry has control over the entry but access
 * can always be revoked by a master revoke/ban list database. Banned entries will be treated like they
 * effectively don't exist.
 */
export default class ACLAccessController extends AccessController {
	private acl!: KeyValueStore<AccessFlags>;

	readonly defaultAccessFlags?: AccessFlags;

	// Likely to be defined later by the store type as this lambda likely depends on the store to be created first
	// As orbitdb currently stands this is a circular dependency
	determineAccessType?: (entry: LogEntry<never>) => Promise<AccessType>

	constructor(private orbitDB: OrbitDB, options: ACLAccessControllerOptions) {
		super()

		this.defaultAccessFlags = options.defaultAccessFlags
		this.determineAccessType = options.determineAccessType
	}

	static get type() {
		return 'ACLAccessController'
	}

	get address(): string {
		return this.acl.address.toString()
	}

	async canAppend(entry: LogEntry<never>, identityProvider: IdentityProvider): Promise<boolean> {
		if (!await Identities.verifyIdentity(entry.identity)) {
			console.warn('Identity was invalid!', entry.identity)
			return false;
		}

		const accessType = await this.determineAccessType?.call(undefined, entry);

		const access = Object.assign(new AccessFlags(), this.defaultAccessFlags || {}, this.acl.get(entry.id) || {})

		switch (accessType) {
			case AccessType.create:
				if (!access.create) return false;
				break;
			case AccessType.updateOwn:
				if (!access.updateOwn) return false;
				break;
			case AccessType.updateOther:
				if (!access.updateOther) return false;
				break;
			case AccessType.deleteOwn:
				if (!access.deleteOwn) return false;
				break;
			case AccessType.deleteOther:
				if (!access.deleteOther) return false;
				break;
			case AccessType.noop: return true;
			default:
				console.debug("Unexpected access type:", accessType)
				throw new Error("Unexpected access type!")
		}

		return true
	}

	async setPerms(id: string, perms: AccessFlags) {
		await this.acl.set(id, perms)
	}

	async purgePerms(id: string) {
		await this.acl.del(id)
	}

	async close() {
		await this.acl.close();
	}

	_onUpdate() {
		// @ts-ignore
		this.emit('updated')
	}

	async load(address: string) {
		if (this.acl) {
			await this.acl.close();
		}

		this.acl = await this.orbitDB.keyvalue<AccessFlags>(ACLAccessController.ensureAddress(address),  {
			accessController: {
				type: 'ipfs',
				// @ts-ignore
				write: [this.orbitDB.identity.id]
			},
			// @ts-ignore
			sync: true
		});

		this.acl.events.on('ready', this._onUpdate.bind(this));
		this.acl.events.on('write', this._onUpdate.bind(this));
		this.acl.events.on('replicated', this._onUpdate.bind(this));

		await this.acl.load()
	}

	async grant(capability: string, key: string) {
		const currentFlags = await this.acl.get(key) || new AccessFlags()
		// @ts-ignore
		currentFlags[capability] = true;
		await this.acl.set(key, currentFlags)
	}

	async revoke(capability: string, key: string) {
		const currentFlags = await this.acl.get(key) || new AccessFlags()
		// @ts-ignore
		currentFlags[capability] = false;
		await this.acl.set(key, currentFlags)
	}

	async save() {
		return {
			address: this.acl.address.toString()
		}
	}

	static async create(orbitDB: OrbitDB, options: ACLAccessControllerOptions): Promise<ACLAccessController> {
		const controller = new ACLAccessController(orbitDB, options);
		await controller.load(options.address || 'default-acl-controller');

		if (options.creatorHasAllPerms !== false && !options.address) {
			// @ts-ignore
			await controller.setPerms(orbitDB.identity.id, {
				create: true,
				updateOwn: true,
				updateOther: true,
				deleteOwn: true,
				deleteOther: true,
			})
		}

		return controller;
	}

	private static ensureAddress(address: string) {
		const suffix = address.toString().split('/').pop()
		return suffix === '_access' ? address : `${address}/_access`
	}
}

AccessControllers.addAccessController({AccessController: ACLAccessController});
