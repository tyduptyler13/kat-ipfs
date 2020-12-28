import ipfs from './IPFSService'
import OrbitDB from "orbit-db";
import ACLKeyValueStore from "@/domain/ACLKeyValueStore";

export class OrbitDBService {

    static instance = new OrbitDBService()

    private orbitDB?: OrbitDB

    private constructor() {
        this.build()
    }

    async build() {
        this.orbitDB = await OrbitDB.createInstance(await ipfs)
    }

    async createACLDatabase<T>(address: string): Promise<ACLKeyValueStore<T>> {
        return await this.orbitDB!!.open(address, {
            type: ACLKeyValueStore.type
        }) as ACLKeyValueStore<T>
    }
}

export default OrbitDBService.instance
