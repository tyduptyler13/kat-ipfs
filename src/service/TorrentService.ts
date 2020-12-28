import Torrent from '@/domain/Torrent';
import orbitDBService from "@/service/OrbitDBService";
import ACLKeyValueStore from "@/domain/ACLKeyValueStore";

export class TorrentService {
    static instance: TorrentService = new TorrentService();

    private db!: ACLKeyValueStore<Torrent>

    private constructor() {
        this.build()
    }

    async build() {
        this.db = await orbitDBService.createACLDatabase<Torrent>('TODO')
    }

    createTorrent(torrent: Torrent) {

    }

    updateTorrent(torrent: Torrent) {

    }

    deleteTorrent(id: string) {

    }

    retrieveTorrent(id: string): Torrent {
        return this.db.get(id)
    }
}

export default TorrentService.instance
