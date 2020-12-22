import ACLAccessController from "../domain/ACLAccessController";
import IPFS from 'ipfs';
import OrbitDB from "orbit-db";

(async () => {
	const ipfs = await IPFS.create()
	const orbitdb = await OrbitDB.createInstance(ipfs)
	const torrentsDB = await orbitdb.keyvalue('kat-ipfs-torrents', {
		accessController: {
			type: ACLAccessController.type
		}
	});

	const usersDB = await orbitdb.keyvalue('kat-ipfs-users', {
		accessController: {
			type: ACLAccessController.type
		}
	});

	console.log("TorrentDB:", torrentsDB.address);
	console.log("UserDB:", torrentsDB.address);

	await torrentsDB.close()
	await usersDB.close();
	await orbitdb.disconnect();

	process.exit();
})();
