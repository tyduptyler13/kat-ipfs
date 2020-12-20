import OrbitDB from 'orbit-db';
import Torrent from '@/domain/Torrent';

export class TorrentService {
    static instance: TorrentService;

    createTorrent(torrent: Torrent) {

    }

    updateTorrent(torrent: Torrent) {

    }

    deleteTorrent(id: string) {

    }

    retrieveTorrent(id: string): Torrent {

    }
}

export default TorrentService.instance = new TorrentService()
