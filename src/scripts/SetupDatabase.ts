import ACLAccessController from "../domain/ACLAccessController";
import IPFS from 'ipfs';
import OrbitDB from "orbit-db";
import ACLKeyValueStore from "@/domain/ACLKeyValueStore";

(async () => {
	const ipfs = await IPFS.create()
	const orbitdb = await OrbitDB.createInstance(ipfs)
	const torrentsDB = await orbitdb.create('kat-ipfs-torrents', ACLKeyValueStore.type, {
		accessController: {
			type: ACLAccessController.type
		}
	});

	const usersDB = await orbitdb.create('kat-ipfs-users', ACLKeyValueStore.type, {
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
