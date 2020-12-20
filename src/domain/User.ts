
export default class User {
    username = ""
    email = ""

    constructor(public readonly id: string,
                public readonly publicKey: string) {
    }
}
