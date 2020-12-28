import IPFS from "ipfs";
import winr from "why-is-node-running";

// IPFS doesn't shutdown https://github.com/libp2p/js-libp2p/issues/779
(async () => {
    const ipfs = await IPFS.create()

    await ipfs.stop();

    winr();
})();
