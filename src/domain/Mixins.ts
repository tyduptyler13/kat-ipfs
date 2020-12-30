/**
 * A class mixin that lets you use method chaining construction
 * @param Base - The base type to mixin with
 */
export function withWith<TBase extends new (...args: any[]) => object>(Base: TBase) {
	return class extends Base {
		with(closure: (it: InstanceType<TBase>) => void) {
			// @ts-ignore
			closure(this);
			return this;
		}
	}
}
