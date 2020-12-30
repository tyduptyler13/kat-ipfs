import lunr from 'lunr'
import Torrent from "../domain/Torrent";
import { withWith } from '../domain/Mixins';

const WithTorrent = withWith(Torrent);

const torrentTest: Array<Torrent> = [
	new WithTorrent('beef').with(it => { it.description = "A test torrent" }),
	new WithTorrent('beef2').with(it => { it.description = "Another test torrent" })
]

const idx = lunr(function() {
	this.ref('magnet')
	this.field('description')

	torrentTest.forEach((it) => this.add(it))
})

console.log(JSON.stringify(idx))
