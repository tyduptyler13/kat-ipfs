import 'mocha';
import IPFS from 'ipfs';
import OrbitDB from "orbit-db";
import chai, {assert} from "chai";
import chaiAsPromised from "chai-as-promised";
import ACLAccessController from "../../src/domain/ACLAccessController";
import ACLKeyValueStore from "../../src/domain/ACLKeyValueStore";
import Store from "orbit-db-store";

chai.use(chaiAsPromised);

describe('kat-ipfs', () => {

    let ipfsA!: IPFS.IPFS, ipfsB!: IPFS.IPFS
    let orbitDBA!: OrbitDB, orbitDBB!: OrbitDB

    before(async () => {
        ipfsA = await IPFS.create({repo: './ipfsA'});
        ipfsB = await IPFS.create({
            repo: './ipfsB',
            // @ts-ignore
            config: {
                Addresses: {
                    Swarm: [
                        "/ip4/127.0.0.1/tcp/4004",
                        "/ip4/127.0.0.1/tcp/4005/ws",
                    ],
                    API: "/ip4/127.0.0.1/tcp/5001"
                }
            }
        });

        // Sync the clients
        await ipfsA.swarm.connect((await ipfsB.id()).addresses[0])
        await ipfsB.swarm.connect((await ipfsA.id()).addresses[0])

        orbitDBA = await OrbitDB.createInstance(ipfsA, {directory: './orbitdbA'});
        orbitDBB = await OrbitDB.createInstance(ipfsB, {directory: './orbitdbB'});
    });

    it('Has different peer id', async () => {
        assert.notEqual(await ipfsA.id(), await ipfsB.id())
        assert.notEqual(orbitDBA.id, orbitDBB.id)
    })

    describe('ACLAccessController', () => {

        let dbA!: ACLKeyValueStore<string>
        let dbB!: ACLKeyValueStore<string>

        before(async () => {
            dbA = await orbitDBA.create('test-db', ACLKeyValueStore.type, {
                accessController: {
                    type: ACLAccessController.type
                },
                overwrite: true
            }) as ACLKeyValueStore<string>

            dbB = await orbitDBB.open(dbA.address.toString(), {
                type: ACLKeyValueStore.type,
                overwrite: true
            }) as ACLKeyValueStore<string>
        })

        it('#create', async () => {
            await dbA.put('test', 'test')
            await waitForReplication(dbB, () => assert.equal(dbB.get('test'), 'test'))
            await assert.isRejected(dbB.put('test', 'test2'), `Could not append entry, key "${dbB.identity.id}" is not allowed to write to the log`)
        })

        it('#updateOwn', async () => {
            if (!dbA.get('test')) {
                // Make sure we have an entry first!
                await dbA.put('test', 'test');
                // Wait for it to replicate
                await waitForReplication(dbB, () => assert.equal(dbB.get('test'), 'test'))
            }

            // Update
            await dbA.put('test', 'test2')
            await waitForReplication(dbB, () => assert.equal(dbB.get('test'), 'test2'))
        })

        it('#updateOther', async () => {
            if (!dbA.get('test')) {
                // Make sure we have an entry first!
                await dbA.put('test', 'test');
                // Wait for it to replicate
                await waitForReplication(dbB, () => assert.equal(dbB.get('test'), 'test'))
            }
            await assert.isRejected(dbB.put('test', 'test2'), `Could not append entry, key "${dbB.identity.id}" is not allowed to write to the log`)
        })

        it('#deleteOwn', async () => {
            if (!dbA.get('test')) {
                // Make sure we have an entry first!
                await dbA.put('test', 'test');
                // Wait for it to replicate
                await waitForReplication(dbB, () => assert.equal(dbB.get('test'), 'test'))
            }

            await dbA.del('test')
            await waitForReplication(dbB, () => assert.notExists(dbB.get('test')))
        })

        it('#deleteOther', async () => {
            if (!dbA.get('test')) {
                // Make sure we have an entry first!
                await dbA.put('test', 'test');
                // Wait for it to replicate
                await waitForReplication(dbB, () => assert.equal(dbB.get('test'), 'test'))
            }

            await assert.isRejected(dbB.del('test'), `Could not append entry, key "${dbB.identity.id}" is not allowed to write to the log`);
        })

        it('#noop', async () => {
            // TODO
        })

        after(async () => {
            await dbA.close()
            await dbB.close()
        })
    })

    after(async () => {
        orbitDBA && await orbitDBA.disconnect();
        orbitDBB && await orbitDBB.disconnect();

        ipfsA && await ipfsA.stop()
        ipfsB && await ipfsB.stop()

        process.exit()
    })
})

function waitForReplication(db: Store, closure: () => void, timeout = 5000): Promise<void> {
    const timeoutID = setTimeout(() => assert.fail(`Did not replicate withing ${timeout / 1000}s`), timeout)

    return new Promise((accept) => {
        db.events.once('replicated', () => {
            closure()
            clearTimeout(timeoutID)
            accept()
        });
    });
}
